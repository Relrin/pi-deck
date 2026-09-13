import type { Locale } from "@pi-deck/core";
import type { TranslationFunctions } from "./i18n-types";
import { i18nObject, loadedLocales } from "./i18n-util";
import { useLocaleStore } from "./useLocaleStore";

/**
 * Imperative translation access for code that is not a React component: notification builders
 * (`features/_status/useNotificationStore.ts` and its callers), zustand actions, and the error
 * formatter. React components use `useI18nContext()` instead, so they re-render on a locale change.
 *
 * Resolution is synchronous — the catalog is loaded before the app renders — so call sites stay
 * ordinary function calls with no await and no hook rules.
 */

/**
 * One-entry memo. Keyed on the dictionary *reference* as well as the locale, so it invalidates
 * itself when the dev pseudo-locale swaps the loaded dictionary in place. That is deliberately not
 * an explicit `reset()` the store has to call: this module must stay a dependency leaf, and having
 * `useLocaleStore` import from here would close an import cycle.
 */
let memo: { locale: Locale; dict: unknown; ll: TranslationFunctions } | undefined;

/** Translations for an explicit locale. */
export function llFor(locale: Locale): TranslationFunctions {
  const dict = loadedLocales[locale];
  if (memo && memo.locale === locale && memo.dict === dict) return memo.ll;
  const ll = i18nObject(locale);
  memo = { locale, dict, ll };
  return ll;
}

/**
 * The active UI locale, read at call time.
 *
 * This is the default for the `locale` parameter on the `lib/format/` helpers, which is what lets
 * them stay ordinary functions for tests and for imperative callers. A React component must still
 * pass its own locale (from `useI18nContext()`) — reading the store here creates no subscription,
 * so a component that relies on the default renders correctly once and then goes stale on a
 * language switch.
 */
export function currentLocale(): Locale {
  return useLocaleStore.getState().uiLocale;
}

/** Translations for the current UI locale. Read it at call time — never hoist to module scope. */
export function ll(): TranslationFunctions {
  return llFor(currentLocale());
}
