const USERNAME_MAX_LENGTH = 48;
const SEASON_NAME_MAX_LENGTH = 96;
const DRILL_NAME_MAX_LENGTH = 96;

function toStringValue(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value : "";
}

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeUsername(value: FormDataEntryValue | null | undefined) {
  return normalizeWhitespace(toStringValue(value));
}

export function normalizeUsernameKey(value: string) {
  return normalizeWhitespace(value).toLocaleLowerCase("en-US");
}

export function normalizeSeasonName(value: FormDataEntryValue | null | undefined) {
  return normalizeWhitespace(toStringValue(value));
}

export function normalizeDrillName(value: FormDataEntryValue | null | undefined) {
  return normalizeWhitespace(toStringValue(value));
}

export function readRequiredId(value: FormDataEntryValue | null | undefined) {
  const id = toStringValue(value).trim();
  return id || null;
}

export function validateUsername(username: string) {
  if (!username) return "Username is required.";
  if (username.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateSeasonName(seasonName: string) {
  if (!seasonName) return "Season name is required.";
  if (seasonName.length > SEASON_NAME_MAX_LENGTH) {
    return `Season name must be ${SEASON_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function validateDrillName(drillName: string) {
  if (!drillName) return "Drill name is required.";
  if (drillName.length > DRILL_NAME_MAX_LENGTH) {
    return `Drill name must be ${DRILL_NAME_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function parseTimeSeconds(value: FormDataEntryValue | null | undefined) {
  const numeric = Number.parseFloat(toStringValue(value));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * 1000) / 1000;
}
