import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `sessions` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const sessions = {
  filter: {
    // Russian prefers the impersonal "выбрано: N" here, which needs no agreement with the count.
    selectedCount: "выбрано: {count}",
  },
} as const satisfies DeepPartial<Translation["sessions"]>;

export default sessions;
