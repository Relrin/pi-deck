import { SUMMARY_TRUNCATE_MAX } from "../ui-constants.js";

/**
 * Truncate a string to at most `max` characters, replacing the middle with an ellipsis.
 * Useful for paths and commands where both ends are informative (e.g. file basename).
 */
export function truncateMiddle(input: string, max: number = SUMMARY_TRUNCATE_MAX): string {
  if (typeof input !== "string") return "";
  if (input.length <= max) return input;
  if (max <= 1) return input.slice(0, max);
  const ellipsis = "…";
  const keep = max - ellipsis.length;
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  if (tail <= 0) return `${input.slice(0, keep)}${ellipsis}`;
  return `${input.slice(0, head)}${ellipsis}${input.slice(input.length - tail)}`;
}

/**
 * Truncate a string to at most `max` characters, appending an ellipsis at the end.
 * Use for commands or summaries where the tail is less informative.
 */
export function truncateEnd(input: string, max: number = SUMMARY_TRUNCATE_MAX): string {
  if (typeof input !== "string") return "";
  if (input.length <= max) return input;
  if (max <= 1) return input.slice(0, max);
  return `${input.slice(0, max - 1)}…`;
}
