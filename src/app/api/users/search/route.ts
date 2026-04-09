import { NextResponse } from "next/server";

import { getAdminSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { normalizeUsernameKey } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = normalizeUsernameKey(url.searchParams.get("q") ?? "");

  const users = await db.user.findMany({
    where: query
      ? {
          usernameNormalized: {
            contains: query,
          },
        }
      : undefined,
    orderBy: [{ username: "asc" }],
    take: 12,
    select: {
      id: true,
      username: true,
    },
  });

  return NextResponse.json({ users });
}
