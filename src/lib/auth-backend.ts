import {
  PasswordResetRequestStatus,
  Prisma,
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
import { normalizeUsername, normalizeUsernameKey } from "@/lib/validators";

const DEFAULT_SETUP_CODE_TTL_HOURS = 48;
const MAX_SETUP_CODE_TTL_HOURS = 24 * 14;

const authUserSelect = {
  id: true,
  username: true,
  usernameNormalized: true,
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

export type SetupTokenMetadata = {
  username: string;
  role: UserRole;
  expiresAt: Date;
  status: "active" | "expired" | "used";
};

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

function toCurrentUser(user: AuthUserRecord): CurrentAuthUser {
  return {
    id: user.id,
    username: user.username,
    usernameNormalized: user.usernameNormalized,
    role: user.role,
    passwordHash: user.passwordHash,
    passwordUpdatedAt: user.passwordUpdatedAt,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt,
  };
}

export async function authenticateWithCredentials(params: {
  username: string;
  password: string;
  portal: "admin" | "any";
}) {
  const lookup = normalizeUsernameLookup(params.username);
  if (!lookup || !params.password) {
    return null;
  }

  const user = await db.user.findFirst({
    where: { usernameNormalized: lookup.usernameNormalized },
    select: authUserSelect,
  });

  if (!user) {
    return null;
  }

  if (params.portal === "admin" && user.role !== UserRole.ADMIN) {
    return null;
  }

  if (await verifyPasswordHash(params.password, user.passwordHash)) {
    return user;
  }

  const codeHash = hashSetupCode(params.password);
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

export async function completeSetupWithCode(params: {
  code: string;
  username?: string | null;
  newPassword: string;
}) {
  const codeHash = hashSetupCode(params.code);
  if (!codeHash) {
    throw new AuthFlowError("invalid_setup_code", "Setup code is invalid.", 400);
  }

  const usernameLookup = params.username
    ? normalizeUsernameLookup(params.username)
    : null;
  const passwordHash = await hashPassword(params.newPassword);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const setupCode = await tx.setupCode.findUnique({
      where: { codeHash },
      select: {
        id: true,
        purpose: true,
        userId: true,
        usedAt: true,
        revokedAt: true,
        expiresAt: true,
        user: {
          select: authUserSelect,
        },
      },
    });

    if (!setupCode || setupCode.purpose !== SetupCodePurpose.ONBOARDING) {
      throw new AuthFlowError("invalid_setup_code", "Setup code is invalid.", 400);
    }

    if (
      usernameLookup &&
      setupCode.user.usernameNormalized !== usernameLookup.usernameNormalized
    ) {
      throw new AuthFlowError("invalid_setup_code", "Setup code is invalid.", 400);
    }

    if (setupCode.usedAt) {
      throw new AuthFlowError("setup_code_used", "Setup code has already been used.", 409);
    }

    if (setupCode.revokedAt || setupCode.expiresAt <= now) {
      throw new AuthFlowError("setup_code_expired", "Setup code has expired.", 410);
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
      throw new AuthFlowError("invalid_setup_code", "Setup code is invalid.", 400);
    }

    const updatedUser = await tx.user.update({
      where: { id: setupCode.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: now,
        mustChangePassword: false,
      },
      select: currentUserSelect,
    });

    await tx.setupCode.updateMany({
      where: {
        userId: setupCode.userId,
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    return updatedUser;
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

export async function issueSetupCodeForUser(params: {
  userId: string;
  issuedByUserId?: string | null;
  purpose: SetupCodePurpose;
  passwordResetRequestId?: string | null;
  expiresInHours?: number | null;
}) {
  const plaintextCode = generateSetupCode();
  const codeHash = hashSetupCode(plaintextCode);
  const codeSuffix = getSetupCodeSuffix(plaintextCode);
  const now = new Date();
  const expiresAt = getSetupCodeExpiry(params.expiresInHours);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: currentUserSelect,
    });

    if (!user) {
      throw new AuthFlowError("user_not_found", "User not found.", 404);
    }

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

    const setupCode = await tx.setupCode.create({
      data: {
        userId: params.userId,
        issuedByUserId: params.issuedByUserId ?? null,
        passwordResetRequestId: params.passwordResetRequestId ?? null,
        purpose: params.purpose,
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
        passwordResetRequestId: true,
      },
    });

    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data:
        params.purpose === SetupCodePurpose.PASSWORD_RESET
          ? {
              mustChangePassword: true,
            }
          : {},
      select: currentUserSelect,
    });

    return {
      user: updatedUser,
      setupCode,
    };
  });

  return {
    user: result.user,
    setupCode: {
      ...result.setupCode,
      code: plaintextCode,
    },
  };
}

export async function getSetupTokenMetadata(token: string): Promise<SetupTokenMetadata | null> {
  const codeHash = hashSetupCode(token);
  if (!codeHash) {
    return null;
  }

  const setupCode = await db.setupCode.findUnique({
    where: { codeHash },
    select: {
      expiresAt: true,
      usedAt: true,
      revokedAt: true,
      user: {
        select: {
          username: true,
          role: true,
        },
      },
    },
  });

  if (!setupCode) {
    return null;
  }

  const now = Date.now();
  const status =
    setupCode.usedAt || setupCode.revokedAt
      ? "used"
      : setupCode.expiresAt.getTime() <= now
        ? "expired"
        : "active";

  return {
    username: setupCode.user.username,
    role: setupCode.user.role,
    expiresAt: setupCode.expiresAt,
    status,
  };
}

export async function createPasswordResetRequest(usernameInput: string) {
  const lookup = normalizeUsernameLookup(usernameInput);
  if (!lookup) {
    throw new AuthFlowError("invalid_username", "Username is required.", 400);
  }

  const user = await db.user.findFirst({
    where: { usernameNormalized: lookup.usernameNormalized },
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

export async function completeSetupPassword(params: {
  token: string;
  newPassword: string;
}) {
  const codeHash = hashSetupCode(params.token);
  if (!codeHash) {
    throw new AuthFlowError("invalid_setup_token", "Setup token is invalid.", 400);
  }

  const now = new Date();
  const passwordHash = await hashPassword(params.newPassword);

  return db.$transaction(async (tx) => {
    const setupCode = await tx.setupCode.findUnique({
      where: { codeHash },
      select: {
        id: true,
        userId: true,
        passwordResetRequestId: true,
        purpose: true,
        expiresAt: true,
        usedAt: true,
        revokedAt: true,
        user: {
          select: currentUserSelect,
        },
      },
    });

    if (!setupCode) {
      throw new AuthFlowError("invalid_setup_token", "Setup token is invalid.", 400);
    }

    if (setupCode.usedAt || setupCode.revokedAt) {
      throw new AuthFlowError("used_setup_token", "Setup token has already been used.", 409);
    }

    if (setupCode.expiresAt <= now) {
      throw new AuthFlowError("expired_setup_token", "Setup token has expired.", 410);
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
      throw new AuthFlowError("used_setup_token", "Setup token has already been used.", 409);
    }

    const updatedUser = await tx.user.update({
      where: { id: setupCode.userId },
      data: {
        passwordHash,
        passwordUpdatedAt: now,
        mustChangePassword: false,
      },
      select: currentUserSelect,
    });

    await tx.setupCode.updateMany({
      where: {
        userId: setupCode.userId,
        id: { not: setupCode.id },
        usedAt: null,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
      },
    });

    await tx.passwordResetRequest.updateMany({
      where: {
        userId: setupCode.userId,
        status: PasswordResetRequestStatus.APPROVED,
        completedAt: null,
      },
      data: {
        status: PasswordResetRequestStatus.COMPLETED,
        completedAt: now,
      },
    });

    return {
      user: updatedUser,
      setupCode: {
        purpose: setupCode.purpose,
      },
    };
  });
}

export function buildSessionUser(user: CurrentAuthUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    passwordUpdatedAt: user.passwordUpdatedAt.toISOString(),
  };
}

export function serializeCurrentUser(user: CurrentAuthUser) {
  return {
    id: user.id,
    username: user.username,
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
