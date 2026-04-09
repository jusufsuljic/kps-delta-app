import { NextResponse } from "next/server";

import { clearAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await clearAdminSession();

  return NextResponse.redirect(new URL("/", request.url), {
    status: 303,
  });
}
