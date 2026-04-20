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

export function buildChangePasswordHref(params: {
  mode?: "authenticated" | "forced" | "request-reset" | null;
  email?: string | null;
  username?: string | null;
  error?: string | null;
  success?: string | null;
}) {
  return buildHref("/change-password", {
    mode: params.mode ?? null,
    email: params.email ?? null,
    username: params.username ?? null,
    error: params.error ?? null,
    success: params.success ?? null,
  });
}
