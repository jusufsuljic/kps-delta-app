const USERNAME_MAX_LENGTH = 48;
const SEASON_NAME_MAX_LENGTH = 96;
const DRILL_NAME_MAX_LENGTH = 96;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const SETUP_CODE_LENGTH = 20;
const REVIEWER_NOTE_MAX_LENGTH = 512;

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

export function readPassword(value: FormDataEntryValue | null | undefined) {
  return toStringValue(value);
}

export function readOptionalPassword(value: FormDataEntryValue | null | undefined) {
  const password = toStringValue(value);
  return password ? password : null;
}

export function readOptionalText(value: FormDataEntryValue | null | undefined) {
  const text = normalizeWhitespace(toStringValue(value));
  return text ? text : null;
}

export function readRequiredId(value: FormDataEntryValue | null | undefined) {
  const id = toStringValue(value).trim();
  return id || null;
}

export function readPositiveInteger(value: FormDataEntryValue | null | undefined) {
  const numeric = Number.parseInt(toStringValue(value), 10);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric;
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

export function validatePassword(password: string) {
  if (!password || password.trim().length === 0) {
    return "Password is required.";
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}

export function validateSetupCode(code: string) {
  const normalized = code.trim().toLocaleUpperCase("en-US").replace(/[\s-]+/g, "");

  if (!normalized) {
    return "Setup code is required.";
  }

  if (normalized.length !== SETUP_CODE_LENGTH) {
    return "Setup code format is invalid.";
  }

  if (!/^[A-Z2-9]+$/.test(normalized)) {
    return "Setup code format is invalid.";
  }

  return null;
}

export function validateReviewerNote(note: string | null) {
  if (!note) {
    return null;
  }

  if (note.length > REVIEWER_NOTE_MAX_LENGTH) {
    return `Reviewer note must be ${REVIEWER_NOTE_MAX_LENGTH} characters or fewer.`;
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
