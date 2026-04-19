import { NextResponse } from "next/server";
import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { normalizeUsername } from "@/lib/validators";

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
  const formData = await request.formData();
  const username = normalizeUsername(formData.get("username"));
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";

  try {
    const redirectTarget = await signIn("credentials", {
      username,
      password,
      portal: "any",
      redirect: false,
      redirectTo: "/auth/complete",
    });

    return NextResponse.redirect(
      new URL(resolveRedirectTarget(redirectTarget, "/auth/complete"), request.url),
      { status: 303 },
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.redirect(new URL("/login?error=invalid", request.url), {
        status: 303,
      });
    }

    throw error;
  }
}
