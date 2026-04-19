import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { createPasswordResetRequest } from "@/lib/auth-backend";
import { buildChangePasswordHref } from "@/lib/auth-links";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectToChangePassword(request: Request, href: string) {
  return NextResponse.redirect(new URL(href, request.url), { status: 303 });
}

export async function POST(request: Request) {
  const body = await readStringBody(request);
  const username = (body.username ?? "").trim();

  if (!username.trim()) {
    return redirectToChangePassword(
      request,
      buildChangePasswordHref({
        mode: "request-reset",
        error: "missing",
      }),
    );
  }

  await createPasswordResetRequest(username);

  return redirectToChangePassword(
    request,
    buildChangePasswordHref({
      mode: "request-reset",
      username,
      success: "requested",
    }),
  );
}
