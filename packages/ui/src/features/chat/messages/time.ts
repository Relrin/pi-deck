const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Inline message timestamp, e.g. "Jun 4, 20:41" — month + day + HH:MM, in local time. */
export function formatMessageTime(ms: number): string {
  const d = new Date(ms);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day}, ${hh}:${mm}`;
}

/** Full-precision timestamp for the hover tooltip, e.g. "Jun 4, 2026, 20:41:18". */
export function formatMessageTimestampFull(ms: number): string {
  const d = new Date(ms);
  const month = MONTHS[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${month} ${day}, ${year}, ${hh}:${mm}:${ss}`;
}
