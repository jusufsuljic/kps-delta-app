import {
  PasswordResetRequestStatus,
  Prisma,
  RegistrationRequestStatus,
  SetupCodePurpose,
  UserRole,
} from "@prisma/client";

import { db } from "@/lib/db";
import {
  generateSetupCode,
  getSetupCodeSuffix,
  hashPassword,
  hashSetupCode,
  verifyPasswordHash,
} from "@/lib/password";
import {
  buildDisplayName,
  normalizeEmail,
  normalizeEmailKey,
  normalizePersonName,
  normalizePersonNameKey,
  normalizeUsername,
  normalizeUsernameKey,
  validateEmail,
  validatePassword,
  validatePersonName,
} from "@/lib/validators";

const DEFAULT_SETUP_CODE_TTL_HOURS = 48;
const MAX_SETUP_CODE_TTL_HOURS = 24 * 14;

const authUserSelect = {
  id: true,
  username: true,
  usernameNormalized: true,
  firstName: true,
  lastName: true,
  email: true,
  emailNormalized: true,
  role: true,
  passwordHash: true,
  passwordUpdatedAt: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const currentUserSelect = {
  id: true,
  username: true,
  usernameNormalized: true,
  firstName: true,
  lastName: true,
  email: true,
  emailNormalized: true,
  role: true,
  passwordHash: true,
  passwordUpdatedAt: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const passwordResetListSelect = {
  id: true,
  status: true,
  reviewerNote: true,
  createdAt: true,
  reviewedAt: true,
  completedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      role: true,
    },
  },
  reviewedBy: {
    select: {
      id: true,
      username: true,
    },
  },
  setupCode: {
    select: {
      id: true,
      purpose: true,
      codeSuffix: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
    },
  },
} satisfies Prisma.PasswordResetRequestSelect;

type AuthUserRecord = Prisma.UserGetPayload<{
  select: typeof authUserSelect;
}>;

export type CurrentAuthUser = Prisma.UserGetPayload<{
  select: typeof currentUserSelect;
}>;

export type PasswordResetRequestListItem = Prisma.PasswordResetRequestGetPayload<{
  select: typeof passwordResetListSelect;
}>;

const registrationRequestListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  fullNameNormalized: true,
  email: true,
  emailNormalized: true,
  status: true,
  reviewerNote: true,
  createdAt: true,
  reviewedAt: true,
  reviewedBy: {
    select: {
      id: true,
      username: true,
    },
  },
  approvedUser: {
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  },
} satisfies Prisma.RegistrationRequestSelect;

export type RegistrationRequestListItem = Prisma.RegistrationRequestGetPayload<{
  select: typeof registrationRequestListSelect;
}>;

export class AuthFlowError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AuthFlowError";
  }
}

function resolveSetupCodeTtlHours(expiresInHours?: number | null) {
  if (!expiresInHours) {
    return DEFAULT_SETUP_CODE_TTL_HOURS;
  }

  return Math.min(Math.max(expiresInHours, 1), MAX_SETUP_CODE_TTL_HOURS);
}

function getSetupCodeExpiry(expiresInHours?: number | null) {
  const ttlHours = resolveSetupCodeTtlHours(expiresInHours);
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

function normalizeUsernameLookup(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const usernameNormalized = normalizeUsernameKey(username);

  if (!username || !usernameNormalized) {
    return null;
  }

  return {
    username,
    usernameNormalized,
  };
}

function normalizeEmailLookup(emailInput: string) {
  const email = normalizeEmail(emailInput);
  const emailNormalized = normalizeEmailKey(email);

  if (!email || validateEmail(email) || !emailNormalized) {
    return null;
  }

  return {
    email,
    emailNormalized,
  };
}

function toFullNameKey(firstName: string, lastName: string) {
  return normalizePersonNameKey(buildDisplayName(firstName, lastName));
}

function toCurrentUser(user: AuthUserRecord): CurrentAuthUser {
  return {
    id: user.id,
    username: user.username,
    usernameNormalized: user.usernameNormalized,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    emailNormalized: user.emailNormalized,
    role: user.role,
    passwordHash: user.passwordHash,
    passwordUpdatedAt: user.passwordUpdatedAt,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

async function authenticateUserPasswordOrResetCode(user: AuthUserRecord, password: string) {
  if (await verifyPasswordHash(password, user.passwordHash)) {
    return user;
  }

  const codeHash = hashSetupCode(password);
  if (!codeHash) {
    return null;
  }

  const now = new Date();

  return db.$transaction(async (tx) => {
    const setupCode = await tx.setupCode.findFirst({
      where: {
        userId: user.id,
        purpose: SetupCodePurpose.PASSWORD_RESET,
        codeHash,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
      },
    });

    if (!setupCode) {
      return null;
    }

    const consumed = await tx.setupCode.updateMany({
      where: {
        id: setupCode.id,
        usedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (consumed.count !== 1) {
      return null;
    }

    return tx.user.update({
      where: { id: user.id },
      data: {
        mustChangePassword: true,
      },
      select: authUserSelect,
    });
  });
}

export type LoginAttemptResult =
  | {
      status: "success";
      user: AuthUserRecord;
    }
  | {
      status: "pending" | "rejected" | "invalid";
      user: null;
    };

export async function inspectLoginAttempt(params: {
  identifier: string;
  password: string;
  portal: "admin" | "any";
}): Promise<LoginAttemptResult> {
  if (!params.password) {
    return {
      status: "invalid",
      user: null,
    };
  }

  if (params.portal === "admin") {
    const emailLookup = normalizeEmailLookup(params.identifier);
    const usernameLookup = normalizeUsernameLookup(params.identifier);
    if (!emailLookup && !usernameLookup) {
      return {
        status: "invalid",
        user: null,
      };
    }

    const user = await db.user.findFirst({
      where: {
        role: UserRole.ADMIN,
        OR: [
          emailLookup ? { emailNormalized: emailLookup.emailNormalized } : undefined,
          usernameLookup ? { usernameNormalized: usernameLookup.usernameNormalized } : undefined,
        ].filter(Boolean) as Prisma.UserWhereInput[],
      },
      select: authUserSelect,
    });

    if (!user) {
      return {
        status: "invalid",
        user: null,
      };
    }

    const authenticatedUser = await authenticateUserPasswordOrResetCode(user, params.password);
    return authenticatedUser
      ? { status: "success", user: authenticatedUser }
      : { status: "invalid", user: null };
  }

  const emailLookup = normalizeEmailLookup(params.identifier);
  if (!emailLookup) {
    return {
      status: "invalid",
      user: null,
    };
  }

  const user = await db.user.findFirst({
    where: { emailNormalized: emailLookup.emailNormalized },
    select: authUserSelect,
  });

  if (user) {
    const authenticatedUser = await authenticateUserPasswordOrResetCode(user, params.password);
    return authenticatedUser
      ? { status: "success", user: authenticatedUser }
      : { status: "invalid", user: null };
  }

  const registrationRequest = await db.registrationRequest.findUnique({
    where: { emailNormalized: emailLookup.emailNormalized },
    select: {
      status: true,
    },
  });

  if (registrationRequest?.status === RegistrationRequestStatus.PENDING) {
    return {
      status: "pending",
      user: null,
    };
  }

  if (registrationRequest?.status === RegistrationRequestStatus.REJECTED) {
    return {
      status: "rejected",
      user: null,
    };
  }

  return {
    status: "invalid",
    user: null,
  };
}

export async function authenticateWithCredentials(params: {
  identifier: string;
  password: string;
  portal: "admin" | "any";
}) {
  const result = await inspectLoginAttempt(params);
  return result.status === "success" ? result.user : null;
}

export async function registerUserApplication(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const firstName = normalizePersonName(params.firstName);
  const lastName = normalizePersonName(params.lastName);
  const email = normalizeEmail(params.email);
  const emailNormalized = normalizeEmailKey(email);

  const firstNameError = validatePersonName(firstName, "First name");
  if (firstNameError) {
    throw new AuthFlowError("invalid_first_name", firstNameError, 400);
  }

  const lastNameError = validatePersonName(lastName, "Last name");
  if (lastNameError) {
    throw new AuthFlowError("invalid_last_name", lastNameError, 400);
  }

  const emailError = validateEmail(email);
  if (emailError) {
    throw new AuthFlowError("invalid_email", emailError, 400);
  }

  const passwordError = validatePassword(params.password);
  if (passwordError) {
    throw new AuthFlowError("invalid_password", passwordError, 400);
  }

  const existingUser = await db.user.findFirst({
    where: { emailNormalized },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new AuthFlowError(
      "account_exists",
      "An account with this email already exists. Log in with your email and password.",
      409,
    );
  }

  const passwordHash = await hashPassword(params.password);
  const fullNameNormalized = toFullNameKey(firstName, lastName);

  return db.registrationRequest.upsert({
    where: { emailNormalized },
    update: {
      firstName,
      lastName,
      fullNameNormalized,
      email,
      passwordHash,
      status: RegistrationRequestStatus.PENDING,
      reviewerNote: null,
      reviewedAt: null,
      reviewedByUserId: null,
      approvedUserId: null,
    },
    create: {
      firstName,
      lastName,
      fullNameNormalized,
      email,
      emailNormalized,
      passwordHash,
      status: RegistrationRequestStatus.PENDING,
    },
    select: {
      id: true,
      status: true,
    },
  });
}

export async function getCurrentUserRecord(userId: string | null | undefined) {
  if (!userId) {
    return null;
  }

  return db.user.findUnique({
    where: { id: userId },
    select: currentUserSelect,
  });
}

export async function listRegistrationRequests(limit = 50) {
  return db.registrationRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: registrationRequestListSelect,
  });
}

async function findBestMatchingShooterByName(
  tx: Prisma.TransactionClient,
  fullNameNormalized: string,
) {
  const candidates = await tx.user.findMany({
    where: {
      role: UserRole.SHOOTER,
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      _count: {
        select: {
          entries: true,
        },
      },
    },
  });

  return candidates
    .filter((user) => {
      const candidateKey =
        user.firstName && user.lastName
          ? toFullNameKey(user.firstName, user.lastName)
          : normalizePersonNameKey(user.username);
      return candidateKey === fullNameNormalized;
    })
    .sort((left, right) => {
      if (left._count.entries !== right._count.entries) {
        return right._count.entries - left._count.entries;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    })[0] ?? null;
}

export async function approveRegistrationRequest(params: {
  requestId: string;
  reviewedByUserId: string;
  reviewerNote?: string | null;
}) {
  const now = new Date();

  return db.$transaction(async (tx) => {
    const request = await tx.registrationRequest.findUnique({
      where: { id: params.requestId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullNameNormalized: true,
        email: true,
        emailNormalized: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!request) {
      throw new AuthFlowError("registration_request_not_found", "Registration request not found.", 404);
    }

    if (request.status !== RegistrationRequestStatus.PENDING) {
      throw new AuthFlowError(
        "registration_request_already_reviewed",
        "Registration request has already been reviewed.",
        409,
      );
    }

    const emailConflict = await tx.user.findFirst({
      where: { emailNormalized: request.emailNormalized },
      select: { id: true },
    });

    if (emailConflict) {
      throw new AuthFlowError(
        "registration_email_conflict",
        "An account with this email already exists.",
        409,
      );
    }

    const matchedUser = await findBestMatchingShooterByName(tx, request.fullNameNormalized);
    const displayName = buildDisplayName(request.firstName, request.lastName);

    const approvedUser = matchedUser
      ? await tx.user.update({
          where: { id: matchedUser.id },
          data: {
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            emailNormalized: request.emailNormalized,
            passwordHash: request.passwordHash,
            passwordUpdatedAt: now,
            mustChangePassword: false,
          },
          select: currentUserSelect,
        })
      : await tx.user.create({
          data: {
            username: displayName,
            usernameNormalized: normalizeUsernameKey(displayName),
            firstName: request.firstName,
            lastName: request.lastName,
            email: request.email,
            emailNormalized: request.emailNormalized,
            role: UserRole.SHOOTER,
            passwordHash: request.passwordHash,
            passwordUpdatedAt: now,
            mustChangePassword: false,
          },
          select: currentUserSelect,
        });

    const reviewedRequest = await tx.registrationRequest.update({
      where: { id: request.id },
      data: {
        status: RegistrationRequestStatus.APPROVED,
        reviewerNote: params.reviewerNote ?? null,
        reviewedAt: now,
        reviewedByUserId: params.reviewedByUserId,
        approvedUserId: approvedUser.id,
      },
      select: registrationRequestListSelect,
    });

    return {
      request: reviewedRequest,
      user: approvedUser,
    };
  });
}

export async function rejectRegistrationRequest(params: {
  requestId: string;
  reviewedByUserId: string;
  reviewerNote?: string | null;
}) {
  const now = new Date();

  const request = await db.registrationRequest.findUnique({
    where: { id: params.requestId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!request) {
    throw new AuthFlowError("registration_request_not_found", "Registration request not found.", 404);
  }

  if (request.status !== RegistrationRequestStatus.PENDING) {
    throw new AuthFlowError(
      "registration_request_already_reviewed",
      "Registration request has already been reviewed.",
      409,
    );
  }

  return db.registrationRequest.update({
    where: { id: params.requestId },
    data: {
      status: RegistrationRequestStatus.REJECTED,
      reviewerNote: params.reviewerNote ?? null,
      reviewedAt: now,
      reviewedByUserId: params.reviewedByUserId,
    },
    select: registrationRequestListSelect,
  });
}

export async function createPasswordResetRequest(identifierInput: string) {
  const emailLookup = normalizeEmailLookup(identifierInput);
  const usernameLookup = emailLookup ? null : normalizeUsernameLookup(identifierInput);

  if (!emailLookup && !usernameLookup) {
    throw new AuthFlowError("invalid_identifier", "Email or username is required.", 400);
  }

  const user = await db.user.findFirst({
    where: emailLookup
      ? { emailNormalized: emailLookup.emailNormalized }
      : { usernameNormalized: usernameLookup?.usernameNormalized },
    select: {
      id: true,
    },
  });

  if (!user) {
    return {
      accepted: true as const,
      created: false as const,
      requestId: null,
    };
  }

  const existing = await db.passwordResetRequest.findFirst({
    where: {
      userId: user.id,
      status: PasswordResetRequestStatus.PENDING,
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
    },
  });

  if (existing) {
    return {
      accepted: true as const,
      created: false as const,
      requestId: existing.id,
    };
  }

  const request = await db.passwordResetRequest.create({
    data: {
      userId: user.id,
    },
    select: {
      id: true,
    },
  });

  return {
    accepted: true as const,
    created: true as const,
    requestId: request.id,
  };
}

export async function listPasswordResetRequests(limit = 50) {
  return db.passwordResetRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: passwordResetListSelect,
  });
}

export async function approvePasswordResetRequest(params: {
  requestId: string;
  reviewedByUserId: string;
  reviewerNote?: string | null;
  expiresInHours?: number | null;
}) {
  const plaintextCode = generateSetupCode();
  const codeHash = hashSetupCode(plaintextCode);
  const codeSuffix = getSetupCodeSuffix(plaintextCode);
  const now = new Date();
  const expiresAt = getSetupCodeExpiry(params.expiresInHours);

  const result = await db.$transaction(async (tx) => {
    const request = await tx.passwordResetRequest.findUnique({
      where: { id: params.requestId },
      select: {
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!request) {
      throw new AuthFlowError("reset_request_not_found", "Password reset request not found.", 404);
    }

    if (request.status !== PasswordResetRequestStatus.PENDING) {
      throw new AuthFlowError(
        "reset_request_already_reviewed",
        "Password reset request has already been reviewed.",
        409,
      );
    }

    await tx.setupCode.updateMany({
      where: {
        userId: request.userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    const setupCode = await tx.setupCode.create({
      data: {
        userId: request.userId,
        issuedByUserId: params.reviewedByUserId,
        passwordResetRequestId: request.id,
        purpose: SetupCodePurpose.PASSWORD_RESET,
        codeHash,
        codeSuffix,
        expiresAt,
      },
      select: {
        id: true,
        purpose: true,
        codeSuffix: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    const reviewedRequest = await tx.passwordResetRequest.update({
      where: { id: request.id },
      data: {
        status: PasswordResetRequestStatus.APPROVED,
        reviewerNote: params.reviewerNote ?? null,
        reviewedAt: now,
        reviewedByUserId: params.reviewedByUserId,
      },
      select: passwordResetListSelect,
    });

    await tx.user.update({
      where: { id: request.userId },
      data: {
        mustChangePassword: true,
      },
    });

    return {
      request: reviewedRequest,
      setupCode,
    };
  });

  return {
    request: result.request,
    setupCode: {
      ...result.setupCode,
      code: plaintextCode,
    },
  };
}

export async function rejectPasswordResetRequest(params: {
  requestId: string;
  reviewedByUserId: string;
  reviewerNote?: string | null;
}) {
  const now = new Date();

  return db.$transaction(async (tx) => {
    const request = await tx.passwordResetRequest.findUnique({
      where: { id: params.requestId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!request) {
      throw new AuthFlowError("reset_request_not_found", "Password reset request not found.", 404);
    }

    if (request.status !== PasswordResetRequestStatus.PENDING) {
      throw new AuthFlowError(
        "reset_request_already_reviewed",
        "Password reset request has already been reviewed.",
        409,
      );
    }

    return tx.passwordResetRequest.update({
      where: { id: params.requestId },
      data: {
        status: PasswordResetRequestStatus.REJECTED,
        reviewerNote: params.reviewerNote ?? null,
        reviewedAt: now,
        reviewedByUserId: params.reviewedByUserId,
      },
      select: passwordResetListSelect,
    });
  });
}

export async function updateCurrentUserPassword(params: {
  userId: string;
  currentPassword?: string | null;
  newPassword: string;
  requireCurrentPassword: boolean;
}) {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: authUserSelect,
  });

  if (!user) {
    throw new AuthFlowError("user_not_found", "User not found.", 404);
  }

  if (params.requireCurrentPassword) {
    const passwordValid = await verifyPasswordHash(params.currentPassword ?? "", user.passwordHash);
    if (!passwordValid) {
      throw new AuthFlowError(
        "invalid_current_password",
        "Current password is incorrect.",
        400,
      );
    }
  }

  const passwordHash = await hashPassword(params.newPassword);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: now,
        mustChangePassword: false,
      },
      select: currentUserSelect,
    });

    await tx.setupCode.updateMany({
      where: {
        userId: params.userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await tx.passwordResetRequest.updateMany({
      where: {
        userId: params.userId,
        status: PasswordResetRequestStatus.APPROVED,
        completedAt: null,
      },
      data: {
        status: PasswordResetRequestStatus.COMPLETED,
        completedAt: now,
      },
    });

    return updatedUser;
  });
}

export function buildSessionUser(user: CurrentAuthUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    passwordUpdatedAt: user.passwordUpdatedAt.toISOString(),
  };
}

export function serializeCurrentUser(user: CurrentAuthUser) {
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
    passwordUpdatedAt: user.passwordUpdatedAt,
    accessEnabled: Boolean(user.passwordHash),
  };
}

export function isAdminRole(role: UserRole) {
  return role === UserRole.ADMIN;
}

export function toSafeCurrentUser(user: AuthUserRecord | CurrentAuthUser) {
  if ("passwordHash" in user) {
    return toCurrentUser(user);
  }

  return user;
}
