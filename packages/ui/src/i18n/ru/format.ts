import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `format` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const format = {
  justNow: "только что",

  duration: {
    // Deliberately compact, mirroring English's "0.0s" / "1m 5s": this is a duration chip in a
    // tool row, not prose, and the unit reads as part of the number. Ordinary Russian typography
    // would space these ("0,0 с"); that convention belongs in body text, not here. The numbers
    // themselves already carry a comma decimal separator via Intl.
    seconds: "{value}с",
    minutesSeconds: "{minutes}м {seconds}с",
  },
} as const satisfies DeepPartial<Translation["format"]>;

export default format;
