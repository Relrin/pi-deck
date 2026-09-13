import type { ReactNode } from "react";
import TypesafeI18n from "./i18n-react";
import { useLocaleStore } from "./useLocaleStore";

/**
 * Binds the locale store to typesafe-i18n's React context.
 *
 * Data flows one way: the store is the source of truth and this only reads it. Never call the
 * context's own `setLocale` — that would give the app two places to change language and they
 * would drift.
 *
 * The `key` remounts the tree on a language switch. `TypesafeI18n` does react to a changed
 * `locale` on its own, but remounting is what guarantees that a component holding a value derived
 * from `LL` in state rather than recomputing it per render cannot show the previous language.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const uiLocale = useLocaleStore((s) => s.uiLocale);

  return (
    <TypesafeI18n key={uiLocale} locale={uiLocale}>
      {children}
    </TypesafeI18n>
  );
}
