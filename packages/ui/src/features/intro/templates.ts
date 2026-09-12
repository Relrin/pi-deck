import type { TranslationFunctions } from "../../i18n/i18n-types";

export interface IntroTemplate {
  id: string;
  num: string;
  title: string;
  blurb: string;
  body: string;
}

/** The template ids, in display order. */
type IntroTemplateId = keyof TranslationFunctions["intro"]["templates"];

/**
 * Identity of each starter template: its stable `id` and the number shown on the card.
 *
 * These two fields stay here rather than moving to the catalog because `id` keys the user's
 * persisted overrides in `localStorage["pi-deck:templates:v1"]` — renaming one would orphan every
 * edit the user has made. The text lives in `i18n/<locale>/intro.ts`.
 */
const TEMPLATE_IDENTITY: readonly { id: IntroTemplateId; num: string }[] = [
  { id: "fix-failing-test", num: "01" },
  { id: "implement-a-spec", num: "02" },
  { id: "refactor-in-place", num: "03" },
  { id: "write-the-docs", num: "04" },
  { id: "review-a-pr", num: "05" },
  { id: "bisect-a-regression", num: "06" },
];

/**
 * The starter templates in the current interface language.
 *
 * A function rather than a constant because the text changes with the locale, and a module-level
 * array would freeze at whatever the locale was when this module was first imported. Call it
 * inside a `useMemo` keyed on `LL`.
 */
export function introTemplates(t: TranslationFunctions): readonly IntroTemplate[] {
  return TEMPLATE_IDENTITY.map(({ id, num }) => {
    const copy = t.intro.templates[id];
    return { id, num, title: copy.title(), blurb: copy.blurb(), body: copy.body() };
  });
}
