import {
  type AgentLanguage,
  DEFAULT_LOCALE,
  isAgentLanguage,
  isLocale,
  type Locale,
} from "@pi-deck/core";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { loadLocaleAsync } from "./i18n-util.async";
import { LOCALE_META } from "./locale-meta";
import { applyPseudoLocale } from "./pseudo";

export interface LocaleState {
  /** Language of the interface. */
  uiLocale: Locale;
  /** Language the agent answers in. `"match-ui"` follows `uiLocale`. */
  agentLanguage: AgentLanguage;
  /** DEV-only pseudo-locale. Forced to `false` in a production build — see `pseudo.ts`. */
  pseudo: boolean;
  setUiLocale: (locale: Locale) => Promise<void>;
  setAgentLanguage: (language: AgentLanguage) => void;
  setPseudo: (on: boolean) => void;
}

export const LOCALE_STORAGE_KEY = "pi-deck:locale";

/**
 * Stamp the document element so CSS and the platform can react before (and independently of) React.
 * Mirrors `applyDensity` / `applyFonts` in `theme/usePreferencesStore.ts`, including the SSR guard.
 * `packages/desktop/index.html` runs the same logic pre-mount so the first paint is already correct.
 */
export function applyLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  const meta = LOCALE_META[locale];
  const root = document.documentElement;
  root.setAttribute("lang", meta.tag);
  root.setAttribute("dir", meta.dir);
  root.setAttribute("data-lang-script", meta.script);
}

/**
 * Locale lives in its own store rather than in `pi-deck:prefs`, for two reasons that both bite
 * later if ignored: translation lookups are imported by nearly every module, so this has to stay a
 * dependency leaf or it starts import cycles; and switching locale has an async side effect
 * (fetching the catalog chunk) that density and fonts do not.
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      uiLocale: DEFAULT_LOCALE,
      agentLanguage: "match-ui",
      pseudo: false,
      setUiLocale: async (locale) => {
        await loadLocaleAsync(locale);
        // The pseudo transform is per-locale and mutates the dictionary in place, so a locale
        // loaded after the toggle was switched on has to be transformed too — otherwise switching
        // language silently drops out of pseudo mode.
        if (get().pseudo) applyPseudoLocale(locale, true);

        applyLocale(locale);
        set({ uiLocale: locale });
      },
      setAgentLanguage: (agentLanguage) => set({ agentLanguage }),
      setPseudo: (on) => {
        applyPseudoLocale(get().uiLocale, on);
        set({ pseudo: on });
      },
    }),
    {
      name: LOCALE_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (!isLocale(state.uiLocale)) state.uiLocale = DEFAULT_LOCALE;
        if (!isAgentLanguage(state.agentLanguage)) state.agentLanguage = "match-ui";

        state.pseudo = import.meta.env?.DEV ? state.pseudo === true : false;
        // A no-op when the catalog for this locale has not loaded yet (a cold start on a non-`en`
        // locale rehydrates before `main.tsx` finishes loading the chunk). `setUiLocale` re-applies
        // it, and so does toggling it off and on.
        applyPseudoLocale(state.uiLocale, state.pseudo);
        applyLocale(state.uiLocale);
      },
    },
  ),
);
