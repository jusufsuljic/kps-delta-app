import { signOut } from "@/lib/auth";
import { redirectToPath, toRedirectPath } from "@/lib/redirect-response";

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

export async function POST() {
  const redirectTarget = await signOut({
    redirect: false,
    redirectTo: "/",
  });

  return redirectToPath(
    toRedirectPath(resolveRedirectTarget(redirectTarget, "/"), "/"),
  );
}
