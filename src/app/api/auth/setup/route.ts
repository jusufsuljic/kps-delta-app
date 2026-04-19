import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import {
  AuthFlowError,
  completeSetupWithCode,
  getSetupTokenMetadata,
} from "@/lib/auth-backend";
import { validatePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function buildSetupRedirect(
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
    new URL(query ? `/setup?${query}` : "/setup", request.url),
    { status: 303 },
  );
}

export async function POST(request: Request) {
  const body = await readStringBody(request);
  const code = body.code || body.token || "";
  const username = body.username ?? "";
  const newPassword = body.newPassword ?? "";
  const confirmPassword = body.confirmPassword ?? "";
  const tokenMeta = code ? await getSetupTokenMetadata(code) : null;

  if (!code || !newPassword || !confirmPassword) {
    return buildSetupRedirect(request, {
      code,
      username: username || tokenMeta?.username,
      role: tokenMeta?.role?.toLowerCase() ?? null,
      expires: tokenMeta?.expiresAt.toISOString() ?? null,
      error: "missing",
    });
  }

  if (newPassword !== confirmPassword) {
    return buildSetupRedirect(request, {
      code,
      username: username || tokenMeta?.username,
      role: tokenMeta?.role?.toLowerCase() ?? null,
      expires: tokenMeta?.expiresAt.toISOString() ?? null,
      error: "mismatch",
    });
  }

  if (validatePassword(newPassword)) {
    return buildSetupRedirect(request, {
      code,
      username: username || tokenMeta?.username,
      role: tokenMeta?.role?.toLowerCase() ?? null,
      expires: tokenMeta?.expiresAt.toISOString() ?? null,
      error: "weak",
    });
  }

  try {
    await completeSetupWithCode({
      code,
      username: username || null,
      newPassword,
    });

    return NextResponse.redirect(new URL("/login?success=setup-complete", request.url), {
      status: 303,
    });
  } catch (error) {
    let errorCode = "invalid";

    if (error instanceof AuthFlowError) {
      if (error.code === "setup_code_expired") {
        errorCode = "expired";
      } else if (error.code === "setup_code_used") {
        errorCode = "used";
      } else if (error.code === "invalid_setup_code") {
        errorCode = "invalid";
      }
    }

    const latestMeta = code ? await getSetupTokenMetadata(code) : null;

    return buildSetupRedirect(request, {
      code,
      username: username || latestMeta?.username,
      role: latestMeta?.role?.toLowerCase() ?? null,
      expires: latestMeta?.expiresAt.toISOString() ?? null,
      error: errorCode,
    });
  }
}
