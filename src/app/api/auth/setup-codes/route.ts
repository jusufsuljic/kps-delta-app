import { SetupCodePurpose } from "@prisma/client";

import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { requireApiAdmin, authFlowErrorResponse } from "@/lib/auth-api";
import {
  issueSetupCodeForUser,
  serializeCurrentUser,
} from "@/lib/auth-backend";
import { buildSetupHref } from "@/lib/auth-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseExpiresInHours(value: string | undefined) {
  const numeric = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function parsePurpose(value: string | undefined) {
  if (!value) {
    return SetupCodePurpose.ONBOARDING;
  }

  if (value === SetupCodePurpose.ONBOARDING || value === SetupCodePurpose.PASSWORD_RESET) {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (authResult.response) {
    return authResult.response;
  }

  const body = await readStringBody(request);
  const userId = body.userId?.trim() ?? "";
  const purpose = parsePurpose(body.purpose);

  if (!userId) {
    return NextResponse.json({ error: "User ID is required." }, { status: 400 });
  }

  if (!purpose) {
    return NextResponse.json({ error: "Setup code purpose is invalid." }, { status: 400 });
  }

  try {
    const result = await issueSetupCodeForUser({
      userId,
      issuedByUserId: authResult.user.id,
      purpose,
      expiresInHours: parseExpiresInHours(body.expiresInHours),
    });

    return NextResponse.json(
      {
        user: serializeCurrentUser(result.user),
        setupCode: result.setupCode,
        setupHref: buildSetupHref({
          token: result.setupCode.code,
          username: result.user.username,
          role: result.user.role,
          expiresAt: result.setupCode.expiresAt,
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    return authFlowErrorResponse(error) ?? NextResponse.json(
      { error: "Unable to issue setup code." },
      { status: 500 },
    );
  }
}
