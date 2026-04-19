import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { authFlowErrorResponse, requireApiAdmin } from "@/lib/auth-api";
import {
  createPasswordResetRequest,
  listPasswordResetRequests,
} from "@/lib/auth-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseLimit(value: string | null) {
  const numeric = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 50;
  }

  return Math.min(numeric, 200);
}

export async function GET(request: Request) {
  const authResult = await requireApiAdmin();
  if (authResult.response) {
    return authResult.response;
  }

  const url = new URL(request.url);
  const requests = await listPasswordResetRequests(parseLimit(url.searchParams.get("limit")));

  return NextResponse.json({ requests });
}

export async function POST(request: Request) {
  const body = await readStringBody(request);

  try {
    const result = await createPasswordResetRequest(body.username ?? "");

    return NextResponse.json(
      {
        accepted: result.accepted,
        requestCreated: result.created,
      },
      { status: 202 },
    );
  } catch (error) {
    return authFlowErrorResponse(error) ?? NextResponse.json(
      { error: "Unable to create password reset request." },
      { status: 500 },
    );
  }
}
