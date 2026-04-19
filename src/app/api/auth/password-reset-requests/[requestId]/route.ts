import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { authFlowErrorResponse, requireApiAdmin } from "@/lib/auth-api";
import {
  approvePasswordResetRequest,
  rejectPasswordResetRequest,
} from "@/lib/auth-backend";
import { readOptionalText } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseExpiresInHours(value: string | undefined) {
  const numeric = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      requestId: string;
    }>;
  },
) {
  const authResult = await requireApiAdmin();
  if (authResult.response) {
    return authResult.response;
  }

  const { requestId } = await context.params;
  const body = await readStringBody(request);
  const action = body.action === "reject" ? "reject" : "approve";
  const reviewerNote = readOptionalText(body.reviewerNote);

  try {
    if (action === "reject") {
      const reviewedRequest = await rejectPasswordResetRequest({
        requestId,
        reviewedByUserId: authResult.user.id,
        reviewerNote,
      });

      return NextResponse.json({ request: reviewedRequest });
    }

    const approved = await approvePasswordResetRequest({
      requestId,
      reviewedByUserId: authResult.user.id,
      reviewerNote,
      expiresInHours: parseExpiresInHours(body.expiresInHours),
    });

    return NextResponse.json(approved);
  } catch (error) {
    return authFlowErrorResponse(error) ?? NextResponse.json(
      { error: "Unable to review password reset request." },
      { status: 500 },
    );
  }
}
