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
 * The `key` forces a remount when the pseudo-locale toggles, because that mutates the loaded
 * dictionary in place rather than changing `locale`, and the provider would otherwise have no
 * reason to re-render.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const uiLocale = useLocaleStore((s) => s.uiLocale);
  const pseudo = useLocaleStore((s) => s.pseudo);

  return (
    <TypesafeI18n key={`${uiLocale}:${pseudo}`} locale={uiLocale}>
      {children}
    </TypesafeI18n>
  );
}
