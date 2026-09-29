const ISO_DURATION_PATTERN =
  /^P(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i;
const LOOSE_HOURS_PATTERN = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i;
const LOOSE_MINUTES_PATTERN = /(\d+)\s*(?:m|min|mins|minute|minutes)\b/i;

const MINUTES_PER_WEEK = 10_080;
const MINUTES_PER_DAY = 1440;

function toNumber(part: string | undefined): number {
  return part ? Number.parseFloat(part) : 0;
}

function positiveOrNull(minutes: number): number | null {
  const rounded = Math.round(minutes);
  return rounded > 0 ? rounded : null;
}

/**
 * Parses an ISO 8601 duration (`PT1H30M`, `PT90M`, `P0DT1H`) into whole
 * minutes. Falls back to loose text ("1 hour 20 mins"). Zero and invalid values
 * are unknown (`null`), since publishers emit `PT0M` for "not set".
 */
export function parseDuration(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? positiveOrNull(value) : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim();
  const iso = text.match(ISO_DURATION_PATTERN);
  if (iso && text.length > 1) {
    const [, weeks, days, hours, minutes, seconds] = iso;
    return positiveOrNull(
      toNumber(weeks) * MINUTES_PER_WEEK +
        toNumber(days) * MINUTES_PER_DAY +
        toNumber(hours) * 60 +
        toNumber(minutes) +
        toNumber(seconds) / 60
    );
  }
  const hours = text.match(LOOSE_HOURS_PATTERN)?.[1];
  const minutes = text.match(LOOSE_MINUTES_PATTERN)?.[1];
  if (!(hours || minutes)) {
    return null;
  }
  return positiveOrNull(toNumber(hours) * 60 + toNumber(minutes));
}

export function toIsoDuration(
  minutes: number | null | undefined
): string | undefined {
  if (!minutes || minutes <= 0) {
    return;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ""}${rest ? `${rest}M` : ""}`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) {
    return "";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) {
    return `${rest} min`;
  }
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** Total time is the explicit value when given, else prep + cook. */
export function resolveTotalMinutes(input: {
  cookMinutes?: number | null;
  prepMinutes?: number | null;
  totalMinutes?: number | null;
}): number | null {
  if (input.totalMinutes) {
    return input.totalMinutes;
  }
  const sum = (input.prepMinutes ?? 0) + (input.cookMinutes ?? 0);
  return sum > 0 ? sum : null;
}
