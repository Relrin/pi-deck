import { DEFAULT_LOCALE, isLocale, type Locale } from "@pi-deck/core";
import { app } from "electron";

/**
 * The five menu labels Electron cannot localize for us.
 *
 * Everything else in `menu.ts` is `role:`-based, and Electron translates those from the **OS**
 * locale. That is precisely why these five are worth translating rather than leaving English: on a
 * Russian Windows the bar reads `File → Отменить / Повторить / Вырезать`, which is a mixed-language
 * menu, not a consistently English one.
 *
 * Deliberately a second, tiny string source rather than a bridge into the renderer's catalog: the
 * main process has no access to the renderer's localStorage, and pulling `typesafe-i18n` into it to
 * carry five words would be a bad trade. `Record<Locale, …>` is what keeps the two from drifting —
 * adding a locale to `LOCALES` in core becomes a compile error right here.
 */
export interface MenuStrings {
  file: string;
  edit: string;
  view: string;
  window: string;
  github: string;
}

const MENU_STRINGS: Record<Locale, MenuStrings> = {
  en: {
    file: "File",
    edit: "Edit",
    view: "View",
    window: "Window",
    github: "pi-deck on GitHub",
  },
  ru: {
    file: "Файл",
    edit: "Правка",
    view: "Вид",
    window: "Окно",
    // `pi-deck` is the product name and `GitHub` a service name; only the joining word is ours.
    github: "pi-deck на GitHub",
  },
};

export function menuStrings(locale: Locale): MenuStrings {
  return MENU_STRINGS[locale];
}

/**
 * The locale to build the menu with before the renderer has reported one.
 *
 * `installAppMenu()` runs in `app.whenReady()`, before any window exists. Defaulting to English
 * would visibly re-label the menu bar a moment after launch for every Russian user. Seeding from
 * `app.getSystemLocale()` instead means the first paint agrees with the `role:` items — which come
 * from that same source — by construction, and only a user who overrode the UI language away from
 * their OS language ever sees a swap.
 */
export function systemLocaleGuess(): Locale {
  const tag = app.getSystemLocale().split(/[-_]/)[0]?.toLowerCase() ?? "";
  return isLocale(tag) ? tag : DEFAULT_LOCALE;
}
