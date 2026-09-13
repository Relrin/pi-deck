/**
 * Strings for the `lib/format/` helpers and `features/chat/messages/time.ts`.
 *
 * Every number here is already formatted by `Intl.NumberFormat` at the call site and interpolated
 * as a string, so a translation only ever moves a unit suffix or the word order — it never has to
 * know about decimal separators or digit grouping. English deliberately has no space before the
 * unit ("0.5s"); Russian does ("0,5 с"), which is exactly the kind of thing a template is for.
 */
const format = {
  /** `relativeTime` under 30 seconds. Anything older goes through `Intl.RelativeTimeFormat`. */
  justNow: "just now",

  duration: {
    /** Under a minute. `value` is pre-formatted — "0.5", "9.5", "12", "45". */
    seconds: "{value:string}s",
    /** A minute and over. Both parts are pre-formatted integers. */
    minutesSeconds: "{minutes:string}m {seconds:string}s",
  },
} as const;

export default format;
