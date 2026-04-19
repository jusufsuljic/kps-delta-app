import { NextResponse } from "next/server";

import { currentUser, refreshCurrentUserSession } from "@/lib/auth";
import {
  AuthFlowError,
  isAdminRole,
  updateCurrentUserPassword,
} from "@/lib/auth-backend";
import { readStringBody } from "@/lib/api-input";
import { validatePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveMode(userMustChangePassword: boolean) {
  return userMustChangePassword ? "forced" : "authenticated";
}

function redirectToChangePassword(
  request: Request,
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return NextResponse.redirect(
    new URL(query ? `/change-password?${query}` : "/change-password", request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=missing", request.url), {
      status: 303,
    });
  }

  const body = await readStringBody(request);
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const mode = resolveMode(user.mustChangePassword);

  if (!newPassword || !confirmPassword || (!user.mustChangePassword && !currentPassword)) {
    return redirectToChangePassword(request, {
      mode,
      error: "missing",
    });
  }

  if (newPassword !== confirmPassword) {
    return redirectToChangePassword(request, {
      mode,
      error: "mismatch",
    });
  }

  if (validatePassword(newPassword)) {
    return redirectToChangePassword(request, {
      mode,
      error: "weak",
    });
  }

  try {
    const updatedUser = await updateCurrentUserPassword({
      userId: user.id,
      currentPassword: currentPassword || null,
      newPassword,
      requireCurrentPassword: !user.mustChangePassword,
    });

    await refreshCurrentUserSession(updatedUser);

    const destination = isAdminRole(updatedUser.role)
      ? "/admin/dashboard?tab=shooters&notice=password-updated"
      : "/profile?tab=account&notice=password-updated";

    return NextResponse.redirect(new URL(destination, request.url), {
      status: 303,
    });
  } catch (error) {
    const errorCode =
      error instanceof AuthFlowError && error.code === "invalid_current_password"
        ? "invalid"
        : "required";

    return redirectToChangePassword(request, {
      mode,
      error: errorCode,
    });
  }
}
