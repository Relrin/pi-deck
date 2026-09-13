import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `shell` namespace. Empty for now — the shell copy is translated in
 * phase 07, and until then every key falls back to English per key via `deepMerge` in `./index.ts`.
 */
const shell = {} as const satisfies DeepPartial<Translation["shell"]>;

export default shell;
