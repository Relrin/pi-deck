import type { Locale } from "@pi-deck/core";

/**
 * Per-locale presentation data — everything about a locale that is not a translated string.
 *
 * `nativeName` is deliberately the endonym: a language picker that says "Russian" to someone who
 * cannot read English is useless, so every option is labelled in its own language and these names
 * are never translated.
 */
export interface LocaleMeta {
  /** BCP-47 tag stamped onto `<html lang>`. */
  tag: string;
  /** The language's name in itself. Never localized. */
  nativeName: string;
  dir: "ltr" | "rtl";
  /**
   * Writing system, stamped as `data-lang-script`. Phase 07 uses it to swap the display font:
   * Instrument Serif (`--font-display`) ships latin and latin-ext only, so Cyrillic would
   * otherwise fall back to a system serif mid-layout.
   */
  script: "latin" | "cyrillic";
  /**
   * Width passed to `Intl.RelativeTimeFormat` in phase 03. English abbreviates cleanly ("5m ago"),
   * Russian does not — `narrow` produces forms most readers find cryptic.
   */
  relativeTimeStyle: "narrow" | "short";
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: {
    tag: "en",
    nativeName: "English",
    dir: "ltr",
    script: "latin",
    relativeTimeStyle: "narrow",
  },
  ru: {
    tag: "ru",
    nativeName: "Русский",
    dir: "ltr",
    script: "cyrillic",
    relativeTimeStyle: "short",
  },
};
