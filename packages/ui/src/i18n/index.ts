/**
 * Localization entry point.
 *
 * Import translations from here rather than reaching for the generated files directly — the
 * `.sync` / `.async` split matters. `i18n-util.sync.ts` statically imports *every* locale, so
 * touching it from renderer code would pull the Russian catalog into the main bundle and defeat
 * the per-locale chunking. Tests are the exception and use it on purpose.
 */

export { deepMerge } from "./deep-merge";
export { localizeHostErrorCode, MAPPED_HOST_ERROR_CODES } from "./host-errors";
export { useI18nContext } from "./i18n-react";
export type { Locales, TranslationFunctions } from "./i18n-types";
export { baseLocale, isLocale as isKnownLocale, locales } from "./i18n-util";
export { loadLocaleAsync } from "./i18n-util.async";
export { LocaleProvider } from "./LocaleProvider";
export { LOCALE_META, type LocaleMeta } from "./locale-meta";
export { rich, slot } from "./rich";
export { currentLocale, ll, llFor } from "./t";
export {
  applyLocale,
  LOCALE_STORAGE_KEY,
  type LocaleState,
  useLocaleStore,
} from "./useLocaleStore";
