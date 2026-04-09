import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ADMIN_SESSION_COOKIE = "kps_delta_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  username: string;
  expiresAt: number;
};

function getEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

function getAuthSecret() {
  return getEnv("AUTH_SECRET");
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(encoded: string) {
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

function signValue(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function createSessionToken(username: string) {
  const payload = encodePayload({
    username,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });

  const signature = signValue(payload);
  return `${payload}.${signature}`;
}

function readSessionToken(token: string | undefined) {
  if (!token || !getAuthSecret()) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = signValue(payloadPart);
  if (!safeEqual(signaturePart, expectedSignature)) {
    return null;
  }

  const payload = decodePayload(payloadPart);
  if (!payload || payload.expiresAt <= Date.now()) {
    return null;
  }

  if (!safeEqual(payload.username, getEnv("ADMIN_USERNAME"))) {
    return null;
  }

  return payload;
}

export async function verifyAdminCredentials(username: string, password: string) {
  const adminUsername = getEnv("ADMIN_USERNAME");
  const adminPassword = getEnv("ADMIN_PASSWORD");

  if (!adminUsername || !adminPassword || !getAuthSecret()) {
    return false;
  }

  return safeEqual(username, adminUsername) && safeEqual(password, adminPassword);
}

export async function createAdminSession() {
  const token = createSessionToken(getEnv("ADMIN_USERNAME"));
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  return readSessionToken(token);
}

export async function isAdminAuthenticated() {
  return Boolean(await getAdminSession());
}

export async function requireAdminSession() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin");
  }

  return session;
}
