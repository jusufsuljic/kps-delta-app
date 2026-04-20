import { NextResponse } from "next/server";

export function toRedirectPath(target: string | null | undefined, fallbackPath: string) {
  if (!target) {
    return fallbackPath;
  }

  if (target.startsWith("/")) {
    return target;
  }

  try {
    const url = new URL(target);
    const path = `${url.pathname}${url.search}${url.hash}`;
    return path || fallbackPath;
  } catch {
    return fallbackPath;
  }
}

export function redirectToPath(path: string, status = 303) {
  return new NextResponse(null, {
    status,
    headers: {
      Location: path,
    },
  });
}
