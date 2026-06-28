import type { AskUserAnswer, AskUserAnswerItem } from "@pi-deck/core/protocol/commands.js";
import type { AskUserQuestion } from "@pi-deck/core/protocol/events.js";

/** Which inline layout an `ask_user_question` payload renders as. Derived purely from shape. */
export type AskLayout = "cards" | "multi" | "preview" | "tabs";

/**
 * Pick the layout from the question payload:
 * - >=2 questions                 -> tabs + review
 * - an option with a code preview -> split preview
 * - `multiSelect`                 -> multi-select
 * - otherwise                     -> option cards
 */
export function pickLayout(questions: AskUserQuestion[]): AskLayout {
  if (questions.length > 1) return "tabs";

  const q = questions[0];
  if (!q) return "cards";

  if (hasCodePreview(q)) return "preview";

  if (q.multiSelect) return "multi";
  return "cards";
}

/**
 * The split-preview layout is for showing *what a choice changes* — a fenced code/diff block.
 * A `preview` that's just prose (a longer trade-off) should NOT switch layouts; those belong in
 * `description` and stay in the cards layout. So we only treat a `preview` as a real preview when
 * it contains a fenced code block — otherwise many models would accidentally trip the split view.
 */
export function hasCodePreview(question: AskUserQuestion): boolean {
  return question.options.some((o) => typeof o.preview === "string" && o.preview.includes("```"));
}

/** Whether to offer the free-text "Something else" answer for a question. Always on unless the
 * model explicitly sets `allowCustom: false` - by design the user always gets an escape hatch
 * from the suggested options, even when the model forgets to opt in. */
export function allowsCustom(question: AskUserQuestion): boolean {
  return question.allowCustom !== false;
}

/** Per-question working state held by the Ask card while the user fills it in. */
export interface AskDraftItem {
  /** Selected option indices (single-select carries 0 or 1; multi-select carries any number). */
  optionIndices: number[];
  /** Free-text answer when the user picked "Something else" on a single-select question. */
  custom?: string;
  /** True when "Something else" is the active single-select choice (UI-only). */
  customActive?: boolean;
  /** Extra free-text items added to a multi-select question ("add one I missed"). */
  added?: string[];
  /** True when an (optional) question was explicitly skipped. */
  skipped?: boolean;
}

export type AskDraft = AskDraftItem[];

/** Initial draft. Single-pick layouts (cards / preview) default to the first option selected,
 *  while multi and tabs start empty so the user makes a deliberate choice. */
export function initialDraft(questions: AskUserQuestion[], layout: AskLayout): AskDraft {
  return questions.map(() =>
    layout === "cards" || layout === "preview" ? { optionIndices: [0] } : { optionIndices: [] },
  );
}

/** Whether a single question's draft counts as answered (for footer enablement + tab ticks). */
export function isQuestionComplete(
  question: AskUserQuestion,
  item: AskDraftItem | undefined,
): boolean {
  if (!item) return false;
  if (item.skipped) return true;
  if (item.customActive) return !!item.custom?.trim();
  const count = item.optionIndices.length + (item.added?.length ?? 0);
  if (count === 0) return false;
  if (question.multiSelect) {
    const min = question.minSelect ?? 1;
    const max = question.maxSelect ?? Number.POSITIVE_INFINITY;
    return count >= min && count <= max;
  }
  return true;
}

/** Whether the whole dialog can be submitted. */
export function canSubmit(
  questions: AskUserQuestion[],
  draft: AskDraft,
  layout: AskLayout,
): boolean {
  if (layout === "tabs") {
    // Every question must be answered or explicitly skipped — none left untouched.
    return questions.every((q, i) => {
      const item = draft[i];
      return item?.skipped || isQuestionComplete(q, item);
    });
  }
  return isQuestionComplete(questions[0] as AskUserQuestion, draft[0]);
}

/** Build the wire answer (index-aligned to `questions`) from the working draft. */
export function buildAnswer(questions: AskUserQuestion[], draft: AskDraft): AskUserAnswer {
  const answers: AskUserAnswerItem[] = questions.map((_q, i) => {
    const item = draft[i] ?? { optionIndices: [] };
    if (item.skipped) return { optionIndices: [], skipped: true };
    const optionIndices = item.customActive ? [] : [...item.optionIndices].sort((a, b) => a - b);
    const out: AskUserAnswerItem = { optionIndices };
    const custom =
      item.customActive && item.custom?.trim()
        ? item.custom.trim()
        : item.added && item.added.length > 0
          ? item.added.join("\n")
          : undefined;
    if (custom) out.custom = custom;
    return out;
  });
  return { answers };
}
