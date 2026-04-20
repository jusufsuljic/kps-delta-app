import { registerUserApplication, AuthFlowError } from "@/lib/auth-backend";
import { readStringBody } from "@/lib/api-input";
import { redirectToPath } from "@/lib/redirect-response";
import { normalizeEmail, normalizePersonName, validatePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectToRegister(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return redirectToPath(query ? `/register?${query}` : "/register");
}

export async function POST(request: Request) {
  const body = await readStringBody(request);
  const firstName = normalizePersonName(body.firstName);
  const lastName = normalizePersonName(body.lastName);
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return redirectToRegister({ error: "missing" });
  }

  if (password !== confirmPassword) {
    return redirectToRegister({ error: "mismatch" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return redirectToRegister({ error: "weak" });
  }

  try {
    await registerUserApplication({
      firstName,
      lastName,
      email,
      password,
    });

    return redirectToPath("/login?success=registration-submitted");
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return redirectToRegister({
        error:
          error.code === "account_exists"
            ? "exists"
            : error.code === "invalid_email"
              ? "invalid-email"
              : "missing",
      });
    }

    throw error;
  }
}
