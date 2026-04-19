import { SetupCodePurpose, UserRole } from "@prisma/client";

import { NextResponse } from "next/server";

import { readStringBody } from "@/lib/api-input";
import { requireApiAdmin } from "@/lib/auth-api";
import { issueSetupCodeForUser } from "@/lib/auth-backend";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseExpiresInHours(value: string | undefined) {
  const numeric = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
}

function escapeCsvValue(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function formatFilenameDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
}

function buildSetupUrl(
  origin: string,
  username: string,
  role: UserRole,
  code: string,
  expiresAt: Date,
) {
  const search = new URLSearchParams();
  search.set("username", username);
  search.set("code", code);
  search.set("role", role.toLowerCase());
  search.set("expires", expiresAt.toISOString());

  return `${origin}/setup?${search.toString()}`;
}

export async function POST(request: Request) {
  const authResult = await requireApiAdmin();
  if (authResult.response) {
    return authResult.response;
  }

  const body = await readStringBody(request);
  const scope = body.scope ?? "setup-pending-shooters";
  const expiresInHours = parseExpiresInHours(body.expiresInHours);

  const users = await db.user.findMany({
    where:
      scope === "all-shooters"
        ? {
            role: UserRole.SHOOTER,
          }
        : {
            role: UserRole.SHOOTER,
            passwordHash: null,
          },
    orderBy: [{ username: "asc" }],
    select: {
      id: true,
      username: true,
      role: true,
    },
  });

  if (users.length === 0) {
    return NextResponse.json(
      { error: "No matching shooter accounts were found for onboarding export." },
      { status: 404 },
    );
  }

  const origin = new URL(request.url).origin;
  const rows = ["username,role,setup_code,setup_url,expires_at"];

  for (const user of users) {
    const issued = await issueSetupCodeForUser({
      userId: user.id,
      issuedByUserId: authResult.user.id,
      purpose: SetupCodePurpose.ONBOARDING,
      expiresInHours,
    });

    rows.push(
      [
        user.username,
        user.role,
        issued.setupCode.code,
        buildSetupUrl(
          origin,
          user.username,
          user.role,
          issued.setupCode.code,
          issued.setupCode.expiresAt,
        ),
        issued.setupCode.expiresAt.toISOString(),
      ]
        .map((value) => escapeCsvValue(String(value)))
        .join(","),
    );
  }

  const now = new Date();

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="delta-onboarding-${formatFilenameDate(now)}.csv"`,
    },
  });
}
