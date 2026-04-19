import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth-api";
import { serializeCurrentUser } from "@/lib/auth-backend";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const authResult = await requireApiUser({
    allowMustChangePassword: true,
  });
  if (authResult.response) {
    return authResult.response;
  }

  return NextResponse.json({
    user: serializeCurrentUser(authResult.user),
  });
}
