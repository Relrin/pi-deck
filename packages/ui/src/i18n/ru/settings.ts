import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `settings` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 */
const settings = {
  skills: {
    scanFoundToast:
      "найдено {count} {{манифестов|манифест|манифеста|манифеста|манифестов|манифестов}} SKILL.md",
    installedTitle: "Установлено: {count} {{навыков|навык|навыка|навыка|навыков|навыков}}",
    scanFoundLabel: "найдено {count} {{навыков|навык|навыка|навыка|навыков|навыков}}",
  },
} as const satisfies DeepPartial<Translation["settings"]>;

export default settings;
