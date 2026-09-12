import type { Locale } from "./locale.js";

/**
 * The handful of strings the *model* reads in the user's language.
 *
 * Everything else the agent layer sends the model stays English on purpose — tool descriptions,
 * JSON-schema field docs, block/deny/timeout reasons. Those are instructions about mechanics, they
 * sit beside the SDK's own English tool descriptions, and mixed-language prompts measurably hurt
 * instruction-following. What belongs here is only content the model *reasons over* or *produces*
 * for the user to read.
 */

interface AgentStrings {
  /** Endonym, interpolated into the output-language directive. */
  languageName: string;
  /** Label prefixing a recorded question in `formatAnswers()`, e.g. the `Q` of `Q1:`. */
  question: string;
  /** Label prefixing the user's answer, e.g. the `A` of `A1:`. */
  answer: string;
  /** Stands in for an answer the user skipped. */
  skipped: string;
  /** Stands in for an answer where nothing was picked. */
  noSelection: string;
}

export const AGENT_STRINGS: Record<Locale, AgentStrings> = {
  en: {
    languageName: "English",
    question: "Q",
    answer: "A",
    skipped: "(skipped)",
    noSelection: "(no selection)",
  },
  ru: {
    languageName: "Russian (Русский)",
    question: "В",
    answer: "О",
    skipped: "(пропущено)",
    noSelection: "(не выбрано)",
  },
};

/**
 * The per-turn output-language directive.
 *
 * One sentence, deliberately. Spelling out "don't translate identifiers, file paths, checkbox
 * markers or code fences" was instruction the model did not need — it recognises what is prose and
 * what is syntax on its own, and in plan mode the prompt it is reading is already written in the
 * target language.
 *
 * Still written in English even when asking for Russian: this is an instruction about behaviour,
 * and models follow those more reliably in English than in the language being requested. Naming
 * the language in both English and its endonym removes any ambiguity about which one is meant.
 */
export function outputLanguageDirective(locale: Locale): string {
  return `Respond in ${AGENT_STRINGS[locale].languageName}.`;
}
