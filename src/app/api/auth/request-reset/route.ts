import { readStringBody } from "@/lib/api-input";
import { createPasswordResetRequest } from "@/lib/auth-backend";
import { buildChangePasswordHref } from "@/lib/auth-links";
import { redirectToPath } from "@/lib/redirect-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectToChangePassword(href: string) {
  return redirectToPath(href);
}

export async function POST(request: Request) {
  const body = await readStringBody(request);
  const email = (body.username ?? body.email ?? "").trim();

  if (!email.trim()) {
    return redirectToChangePassword(
      buildChangePasswordHref({
        mode: "request-reset",
        error: "missing",
      }),
    );
  }

  await createPasswordResetRequest(email);

  return redirectToChangePassword(
    buildChangePasswordHref({
      mode: "request-reset",
      email,
      success: "requested",
    }),
  );
}
