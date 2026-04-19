import { UserRole } from "@prisma/client";

import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { AuthFlowError, type CurrentAuthUser } from "@/lib/auth-backend";

type ApiAuthResult =
  | {
      response: NextResponse;
      user: null;
    }
  | {
      response: null;
      user: CurrentAuthUser;
    };

export async function requireApiUser(options?: {
  allowMustChangePassword?: boolean;
}): Promise<ApiAuthResult> {
  const user = await currentUser();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!options?.allowMustChangePassword && user.mustChangePassword) {
    return {
      user: null,
      response: NextResponse.json(
        {
          error: "Password change required.",
          code: "password_change_required",
        },
        { status: 409 },
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

export async function requireApiAdmin(options?: {
  allowMustChangePassword?: boolean;
}): Promise<ApiAuthResult> {
  const result = await requireApiUser(options);
  if (result.response) {
    return result;
  }

  if (result.user.role !== UserRole.ADMIN) {
    return {
      user: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return result;
}

export function authFlowErrorResponse(error: unknown) {
  if (!(error instanceof AuthFlowError)) {
    return null;
  }

  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    { status: error.status },
  );
}
