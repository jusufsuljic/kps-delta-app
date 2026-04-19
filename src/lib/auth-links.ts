import { UserRole } from "@prisma/client";

function buildHref(path: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }

    search.set(key, value);
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function formatAuthRole(role: UserRole) {
  return role === UserRole.ADMIN ? "admin" : "shooter";
}

export function buildSetupHref(params: {
  code?: string | null;
  token?: string | null;
  username?: string | null;
  role?: UserRole | null;
  expiresAt?: Date | null;
  error?: string | null;
  success?: string | null;
}) {
  return buildHref("/setup", {
    code: params.code ?? params.token ?? null,
    username: params.username ?? null,
    role: params.role ? formatAuthRole(params.role) : null,
    expires: params.expiresAt?.toISOString() ?? null,
    error: params.error ?? null,
    success: params.success ?? null,
  });
}

export function buildChangePasswordHref(params: {
  mode?: "authenticated" | "forced" | "request-reset" | null;
  token?: string | null;
  username?: string | null;
  error?: string | null;
  success?: string | null;
}) {
  return buildHref("/change-password", {
    mode: params.mode ?? null,
    token: params.token ?? null,
    username: params.username ?? null,
    error: params.error ?? null,
    success: params.success ?? null,
  });
}
