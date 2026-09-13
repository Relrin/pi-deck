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

export interface LocaleState {
  /** Language of the interface. */
  uiLocale: Locale;
  /** Language the agent answers in. `"match-ui"` follows `uiLocale`. */
  agentLanguage: AgentLanguage;
  setUiLocale: (locale: Locale) => Promise<void>;
  setAgentLanguage: (language: AgentLanguage) => void;
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
    (set) => ({
      uiLocale: DEFAULT_LOCALE,
      agentLanguage: "match-ui",
      setUiLocale: async (locale) => {
        await loadLocaleAsync(locale);
        applyLocale(locale);
        set({ uiLocale: locale });
      },
      setAgentLanguage: (agentLanguage) => set({ agentLanguage }),
    }),
    {
      name: LOCALE_STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        if (!isLocale(state.uiLocale)) state.uiLocale = DEFAULT_LOCALE;
        if (!isAgentLanguage(state.agentLanguage)) state.agentLanguage = "match-ui";

        applyLocale(state.uiLocale);
      },
    },
  ),
);
