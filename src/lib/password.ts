import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_PREFIX = "scrypt";
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_LENGTH = 16;
const SETUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SETUP_CODE_GROUP_SIZE = 4;
const SETUP_CODE_GROUP_COUNT = 5;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return secret;
}

function safeEqual(left: Buffer, right: Buffer) {
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(SALT_LENGTH).toString("base64url");
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }) as Buffer;

  return [
    PASSWORD_HASH_PREFIX,
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt,
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPasswordHash(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) {
    return false;
  }

  const [prefix, nValue, rValue, pValue, salt, encodedDerivedKey] = passwordHash.split("$");
  const n = Number.parseInt(nValue ?? "", 10);
  const r = Number.parseInt(rValue ?? "", 10);
  const p = Number.parseInt(pValue ?? "", 10);

  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !salt ||
    !encodedDerivedKey ||
    !Number.isFinite(n) ||
    !Number.isFinite(r) ||
    !Number.isFinite(p)
  ) {
    return false;
  }

  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: n,
    r,
    p,
  }) as Buffer;

  return safeEqual(derivedKey, Buffer.from(encodedDerivedKey, "base64url"));
}

export function normalizeSetupCodeInput(value: string) {
  return value.trim().toLocaleUpperCase("en-US").replace(/[\s-]+/g, "");
}

export function hashSetupCode(code: string) {
  const normalized = normalizeSetupCodeInput(code);
  if (!normalized) {
    return "";
  }

  return createHmac("sha256", getAuthSecret()).update(normalized).digest("base64url");
}

export function getSetupCodeSuffix(code: string) {
  const normalized = normalizeSetupCodeInput(code);
  return normalized.slice(-SETUP_CODE_GROUP_SIZE);
}

export function generateSetupCode() {
  const characters: string[] = [];
  const byteCount = SETUP_CODE_GROUP_SIZE * SETUP_CODE_GROUP_COUNT;
  const bytes = randomBytes(byteCount);

  for (const byte of bytes) {
    characters.push(SETUP_CODE_ALPHABET[byte & 31] ?? SETUP_CODE_ALPHABET[0]);
  }

  const groups: string[] = [];
  for (let index = 0; index < characters.length; index += SETUP_CODE_GROUP_SIZE) {
    groups.push(characters.slice(index, index + SETUP_CODE_GROUP_SIZE).join(""));
  }

  return groups.join("-");
}
