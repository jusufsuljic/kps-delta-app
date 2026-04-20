import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";
import { inspectLoginAttempt } from "@/lib/auth-backend";
import { redirectToPath, toRedirectPath } from "@/lib/redirect-response";
import { normalizeEmail, normalizeUsername } from "@/lib/validators";

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
  const identifierInput =
    formData.get("mode") === "admin"
      ? normalizeUsername(formData.get("identifier"))
      : normalizeEmail(formData.get("identifier"));
  const password =
    typeof formData.get("password") === "string"
      ? String(formData.get("password"))
      : "";
  const mode = formData.get("mode") === "admin" ? "admin" : "shooter";

  const attempt = await inspectLoginAttempt({
    identifier: identifierInput,
    password,
    portal: mode === "admin" ? "admin" : "any",
  });

  if (attempt.status !== "success") {
    const search = new URLSearchParams();
    search.set(
      "error",
      attempt.status === "pending"
        ? "pending"
        : attempt.status === "rejected"
          ? "rejected"
          : "invalid",
    );
    if (mode === "admin") {
      search.set("mode", "admin");
    }

    return redirectToPath(`/login?${search.toString()}`);
  }

  try {
    const redirectTarget = await signIn("credentials", {
      identifier: identifierInput,
      password,
      portal: mode === "admin" ? "admin" : "any",
      redirect: false,
      redirectTo: "/auth/complete",
    });

    return redirectToPath(
      toRedirectPath(resolveRedirectTarget(redirectTarget, "/auth/complete"), "/auth/complete"),
    );
  } catch (error) {
    if (error instanceof AuthError) {
      const search = new URLSearchParams();
      search.set("error", "invalid");
      if (mode === "admin") {
        search.set("mode", "admin");
      }

      return redirectToPath(`/login?${search.toString()}`);
    }

    throw error;
  }
}
