export function formatSeconds(totalSeconds: number) {
  if (!Number.isFinite(totalSeconds)) {
    return "--";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;

  if (minutes <= 0) {
    return `${seconds.toFixed(2)}s`;
  }

  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return "Not published yet";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function getInitials(name: string) {
  const pieces = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (pieces.length === 0) {
    return "?";
  }

  return pieces.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function getAvatarHue(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }

  return hash;
}
