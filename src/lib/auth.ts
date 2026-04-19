import { UserRole } from "@prisma/client";

import { redirect } from "next/navigation";
import NextAuth, { type NextAuthResult, type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  authenticateWithCredentials,
  buildSessionUser,
  getCurrentUserRecord,
  isAdminRole,
  type CurrentAuthUser,
} from "@/lib/auth-backend";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionUserFields = {
  id: string;
  username: string;
  role: UserRole;
  mustChangePassword: boolean;
  passwordUpdatedAt: string;
};

function isUserRole(value: unknown): value is UserRole {
  return value === UserRole.ADMIN || value === UserRole.SHOOTER;
}

function readSessionUser(session: Session | null): SessionUserFields | null {
  const user = session?.user as Partial<SessionUserFields> | undefined;
  if (!user) {
    return null;
  }

  if (
    typeof user.id !== "string" ||
    typeof user.username !== "string" ||
    !isUserRole(user.role) ||
    typeof user.mustChangePassword !== "boolean" ||
    typeof user.passwordUpdatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    passwordUpdatedAt: user.passwordUpdatedAt,
  };
}

const authResult = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        portal: { label: "Portal", type: "text" },
      },
      async authorize(credentials) {
        const username =
          typeof credentials?.username === "string" ? credentials.username : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";
        const portal = credentials?.portal === "admin" ? "admin" : "any";

        const user = await authenticateWithCredentials({
          username,
          password,
          portal,
        });

        if (!user) {
          return null;
        }

        return {
          name: user.username,
          ...buildSessionUser(user),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const authUser = user as Partial<
          SessionUserFields & {
            name?: string | null;
          }
        >;

        token.sub = authUser.id ?? token.sub;
        token.name = authUser.username ?? authUser.name ?? token.name;
        token.username = authUser.username;
        token.role = authUser.role;
        token.mustChangePassword = authUser.mustChangePassword;
        token.passwordUpdatedAt = authUser.passwordUpdatedAt;
      }

      if (trigger === "update" && session?.user) {
        const updatedUser = session.user as Partial<SessionUserFields>;

        if (typeof updatedUser.username === "string") {
          token.name = updatedUser.username;
          token.username = updatedUser.username;
        }

        if (isUserRole(updatedUser.role)) {
          token.role = updatedUser.role;
        }

        if (typeof updatedUser.mustChangePassword === "boolean") {
          token.mustChangePassword = updatedUser.mustChangePassword;
        }

        if (typeof updatedUser.passwordUpdatedAt === "string") {
          token.passwordUpdatedAt = updatedUser.passwordUpdatedAt;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || typeof token.sub !== "string") {
        return session;
      }

      const sessionUser = session.user as Session["user"] & Partial<SessionUserFields>;
      sessionUser.id = token.sub;
      sessionUser.name = typeof token.username === "string" ? token.username : sessionUser.name;
      sessionUser.username =
        typeof token.username === "string" ? token.username : sessionUser.username ?? "";
      sessionUser.role = isUserRole(token.role) ? token.role : UserRole.SHOOTER;
      sessionUser.mustChangePassword = Boolean(token.mustChangePassword);
      sessionUser.passwordUpdatedAt =
        typeof token.passwordUpdatedAt === "string" ? token.passwordUpdatedAt : "";

      return session;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = authResult.handlers;
export const auth: NextAuthResult["auth"] = authResult.auth;
export const signIn: NextAuthResult["signIn"] = authResult.signIn;
export const signOut: NextAuthResult["signOut"] = authResult.signOut;
export const unstable_update: NextAuthResult["unstable_update"] =
  authResult.unstable_update;

export async function currentUser() {
  const sessionUser = readSessionUser(await auth());
  if (!sessionUser) {
    return null;
  }

  const user = await getCurrentUserRecord(sessionUser.id);
  if (!user) {
    return null;
  }

  const sessionPasswordUpdatedAt = Date.parse(sessionUser.passwordUpdatedAt);
  if (!Number.isFinite(sessionPasswordUpdatedAt)) {
    return null;
  }

  if (user.passwordUpdatedAt.getTime() > sessionPasswordUpdatedAt) {
    return null;
  }

  return user;
}

export async function requireUser(options?: {
  redirectTo?: string;
  allowMustChangePassword?: boolean;
}) {
  const user = await currentUser();
  if (!user) {
    redirect(options?.redirectTo ?? "/login");
  }

  if (!options?.allowMustChangePassword && user.mustChangePassword) {
    redirect("/change-password?mode=forced");
  }

  return user;
}

export async function requireAdmin(options?: {
  redirectTo?: string;
  allowMustChangePassword?: boolean;
  forbiddenRedirectTo?: string;
}) {
  const user = await requireUser({
    redirectTo: options?.redirectTo ?? "/login?mode=admin",
    allowMustChangePassword: options?.allowMustChangePassword,
  });

  if (!isAdminRole(user.role)) {
    redirect(options?.forbiddenRedirectTo ?? "/");
  }

  return user;
}

export async function requireShooter(options?: {
  redirectTo?: string;
  allowMustChangePassword?: boolean;
  forbiddenRedirectTo?: string;
}) {
  const user = await requireUser({
    redirectTo: options?.redirectTo ?? "/login",
    allowMustChangePassword: options?.allowMustChangePassword,
  });

  if (user.role !== UserRole.SHOOTER) {
    redirect(options?.forbiddenRedirectTo ?? "/admin/dashboard");
  }

  return user;
}

export async function getAdminSession() {
  const user = await currentUser();
  return user && isAdminRole(user.role) ? user : null;
}

export async function getShooterSession() {
  const user = await currentUser();
  return user && user.role === UserRole.SHOOTER ? user : null;
}

export async function getCurrentShooter() {
  return getShooterSession();
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession());
}

export async function isShooterAuthenticated() {
  return Boolean(await getShooterSession());
}

export async function requireAdminSession() {
  return requireAdmin();
}

export async function requireShooterSession() {
  return requireShooter();
}

export async function refreshCurrentUserSession(user: CurrentAuthUser) {
  const session = await auth();
  if (!session?.user) {
    return null;
  }

  return unstable_update({
    ...session,
    user: {
      ...session.user,
      id: user.id,
      name: user.username,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      passwordUpdatedAt: user.passwordUpdatedAt.toISOString(),
    } as Session["user"],
  });
}

export type AuthenticatedUser = CurrentAuthUser;
