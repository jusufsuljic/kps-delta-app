import { NextResponse } from "next/server";

import { signOut } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveRedirectTarget(result: unknown, fallbackPath: string) {
  if (typeof result === "string" && result) {
    return result;
  }

  if (
    typeof result === "object" &&
    result !== null &&
    "url" in result &&
    typeof result.url === "string" &&
    result.url
  ) {
    return result.url;
  }

  return fallbackPath;
}

export async function POST(request: Request) {
  const redirectTarget = await signOut({
    redirect: false,
    redirectTo: "/",
  });

  return NextResponse.redirect(
    new URL(resolveRedirectTarget(redirectTarget, "/"), request.url),
    { status: 303 },
  );
}
