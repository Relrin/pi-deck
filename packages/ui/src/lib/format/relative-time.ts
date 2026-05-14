const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function relativeTime(input: string | number | Date, now: number = Date.now()): string {
  const ts = typeof input === "number" ? input : new Date(input).getTime();
  if (Number.isNaN(ts)) return "";
  const diff = now - ts;
  if (diff < 30_000) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(ts).toLocaleDateString();
}
