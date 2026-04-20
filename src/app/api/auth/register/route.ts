import { NextResponse } from "next/server";

import { registerUserApplication, AuthFlowError } from "@/lib/auth-backend";
import { readStringBody } from "@/lib/api-input";
import { normalizeEmail, normalizePersonName, validatePassword } from "@/lib/validators";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function redirectToRegister(
  request: Request,
  params: Record<string, string | null | undefined>,
) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return NextResponse.redirect(new URL(query ? `/register?${query}` : "/register", request.url), {
    status: 303,
  });
}

export async function POST(request: Request) {
  const body = await readStringBody(request);
  const firstName = normalizePersonName(body.firstName);
  const lastName = normalizePersonName(body.lastName);
  const email = normalizeEmail(body.email);
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return redirectToRegister(request, { error: "missing" });
  }

  if (password !== confirmPassword) {
    return redirectToRegister(request, { error: "mismatch" });
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return redirectToRegister(request, { error: "weak" });
  }

  try {
    await registerUserApplication({
      firstName,
      lastName,
      email,
      password,
    });

    return NextResponse.redirect(new URL("/login?success=registration-submitted", request.url), {
      status: 303,
    });
  } catch (error) {
    if (error instanceof AuthFlowError) {
      return redirectToRegister(request, {
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
