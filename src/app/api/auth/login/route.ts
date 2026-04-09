import { NextResponse } from "next/server";

import { createAdminSession, verifyAdminCredentials } from "@/lib/auth";
import { normalizeUsername } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const formData = await request.formData();
  const username = normalizeUsername(formData.get("username"));
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  const credentialsValid = await verifyAdminCredentials(username, password);
  if (!credentialsValid) {
    return NextResponse.redirect(new URL("/admin?error=invalid", request.url), {
      status: 303,
    });
  }

  await createAdminSession();

  return NextResponse.redirect(new URL("/admin/dashboard", request.url), {
    status: 303,
  });
}
