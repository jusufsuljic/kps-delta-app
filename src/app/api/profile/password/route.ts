import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { requireApiUser, authFlowErrorResponse } from "@/lib/auth-api";
import {
  serializeCurrentUser,
  updateCurrentUserPassword,
} from "@/lib/auth-backend";
import { refreshCurrentUserSession } from "@/lib/auth";
import { validatePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const authResult = await requireApiUser({
    allowMustChangePassword: true,
  });
  if (authResult.response) {
    return authResult.response;
  }

  const body = await readStringBody(request);
  const currentPassword = body.currentPassword ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (confirmPassword && newPassword !== confirmPassword) {
    return NextResponse.json(
      { error: "Password confirmation does not match." },
      { status: 400 },
    );
  }

  if (!authResult.user.mustChangePassword && !currentPassword) {
    return NextResponse.json(
      { error: "Current password is required." },
      { status: 400 },
    );
  }

  try {
    const updatedUser = await updateCurrentUserPassword({
      userId: authResult.user.id,
      currentPassword: currentPassword || null,
      newPassword,
      requireCurrentPassword: !authResult.user.mustChangePassword,
    });

    await refreshCurrentUserSession(updatedUser);

    return NextResponse.json({
      user: serializeCurrentUser(updatedUser),
    });
  } catch (error) {
    return authFlowErrorResponse(error) ?? NextResponse.json(
      { error: "Unable to update password." },
      { status: 500 },
    );
  }
}
