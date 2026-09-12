import type { Locale } from "./locale.js";

/**
 * The words the plan file is written in.
 *
 * The plan file is a user-facing artefact — they read it, edit it, and it is checked into their
 * repo — so it is localized in full, headings and step labels included, not just the prose.
 *
 * Keeping the vocabulary as data rather than embedding it in the prompt text means the prompt, the
 * tests and the plan panel all read one source. The plan-prompt tests assert directly against this.
 */
export interface PlanVocabulary {
  /** H1 that opens the appended prompt section. */
  header: string;
  sections: {
    context: string;
    plan: string;
    files: string;
    verification: string;
  };
  /**
   * Example step labels offered to the model. CAPS by convention — `parsePlan.ts` extracts them
   * with a Unicode uppercase class, so any cased script works.
   */
  labels: readonly string[];
  /** The execution note the model must copy into the plan file verbatim. */
  executionNote: string;
  /** The sentence the model must close its message with. */
  closingLine: string;
  /** Placeholder shown inside the H1 example. */
  titlePlaceholder: string;
}

export const PLAN_VOCABULARY: Record<Locale, PlanVocabulary> = {
  en: {
    header: "# Plan Mode",
    sections: {
      context: "Context",
      plan: "Plan",
      files: "Files to touch",
      verification: "Verification",
    },
    labels: ["EXPLORE", "DESIGN", "WRITE", "WIRE", "TEST"],
    executionNote: "_Execution: mark each step `[~]` when you start it and `[x]` when it's done._",
    closingLine: "Reply with feedback to revise this plan, or approve to switch to execution.",
    titlePlaceholder: "<short imperative title>",
  },
  ru: {
    header: "# Режим планирования",
    sections: {
      context: "Контекст",
      plan: "План",
      files: "Изменяемые файлы",
      verification: "Верификация",
    },
    labels: ["ИССЛЕДОВАНИЕ", "ДИЗАЙН", "ЗАПИСЬ", "СВЯЗАТЬ", "ТЕСТИРОВАНИЕ"],
    executionNote:
      "_Выполнение: отмечайте каждый шаг `[~]` при начале работы и `[x]` по завершению._",
    closingLine: "Оставьте комментарии или подтвердите план, чтобы начать выполнение.",
    titlePlaceholder: "<краткий заголовок в повелительном наклонении>",
  },
};
