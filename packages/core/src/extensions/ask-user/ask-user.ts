import { randomUUID } from "node:crypto";
import {
  defineTool,
  type ExtensionAPI,
  type ExtensionFactory,
} from "@earendil-works/pi-coding-agent";
import type { AskUserAnswer } from "../../protocol/commands.js";
import type { AskUserQuestion } from "../../protocol/events.js";
import type { AskFrontend } from "./frontend.js";
import { AskUserToolParams } from "./schema.js";

/** The tool id the model calls. */
export const ASK_USER_TOOL_NAME = "ask_user_question";

const TOOL_DESCRIPTION =
  "Ask the user one to four structured multiple-choice questions and wait for their answer. " +
  "Reach for this the moment a decision is ambiguous and costly to reverse, or to let the user " +
  "steer a plan - instead of guessing or listing the options as prose. " +
  "IMPORTANT: when you ask, CALL THIS TOOL as your action; do NOT also write the question or its " +
  "options as assistant text - the card renders them. The UI always offers the user a free-text " +
  '"Something else" answer, so you never need to add your own "other" option. ' +
  "Set `multiSelect` for 'choose any', and give an option a `preview` (markdown, e.g. a fenced " +
  "code/diff block) to show what it would change. The tool returns the user's selections as text.";

const TOOL_PROMPT_SNIPPET =
  "ask_user_question — ask the user 1–4 multiple-choice questions and wait for their pick; use " +
  "when a decision is ambiguous or to let them steer a plan.";

const TOOL_GUIDELINES = [
  "When a choice is ambiguous and hard to undo, call ask_user_question instead of guessing.",
  "Call the tool directly - do not first write the question or options as plain text; the card " +
    "renders them. Narrating them as prose and then calling the tool duplicates everything.",
  "Keep each question focused with 2–4 distinct options and a one-line description each.",
  "Use one question for a single decision, or several to gather related choices at once " +
    "(typical while planning).",
  "A free-text answer is always available to the user - don't add your own 'other' / " +
    "'something else' option.",
  "Don't use it for trivial or easily reversible choices - just proceed.",
];

export interface AskUserExtensionOptions {
  /** Where questions are presented and answers collected. pi-deck injects a GUI frontend. */
  frontend: AskFrontend;
}

export interface AskUserController {
  /** Pass to `DefaultResourceLoader({ extensionFactories: [...] })`. */
  readonly factory: ExtensionFactory;
  /** Cancel any in-flight questions (delegates to the frontend). */
  dispose(): void;
}

/**
 * pi-deck's self-contained "ask the user a question" plugin. It registers the
 * `ask_user_question` tool; its `execute()` suspends on the injected {@link AskFrontend} and
 * returns the user's answer as a clean tool result (no terminal dependency, no block-hack).
 *
 * The plugin owns no IO and no network: just the tool and a frontend port, so it can later be
 * lifted into a standalone package.
 */
export function createAskUserExtension(options: AskUserExtensionOptions): AskUserController {
  const { frontend } = options;

  const factory: ExtensionFactory = (pi: ExtensionAPI) => {
    pi.registerTool(
      defineTool({
        name: ASK_USER_TOOL_NAME,
        label: "Ask the user",
        description: TOOL_DESCRIPTION,
        promptSnippet: TOOL_PROMPT_SNIPPET,
        promptGuidelines: TOOL_GUIDELINES,
        parameters: AskUserToolParams,
        async execute(toolCallId, params, signal) {
          const questions = params.questions as AskUserQuestion[];
          const answer = await frontend.present(
            { askId: randomUUID(), toolCallId, questions },
            signal,
          );
          return {
            content: [{ type: "text" as const, text: formatAnswers(questions, answer) }],
            details: undefined,
          };
        },
      }),
    );
  };

  return {
    factory,
    dispose() {
      frontend.dispose?.();
    },
  };
}

/**
 * Render the user's answer as a compact, model-friendly transcript that becomes the tool
 * result. Index-aligned to `questions`, tolerant of a short/partial answers array.
 */
export function formatAnswers(questions: AskUserQuestion[], answer: AskUserAnswer): string {
  if (answer.cancelled) {
    return (
      "The user dismissed the question without answering. Proceed using your best judgment, " +
      "or ask again if you still need a decision."
    );
  }
  const blocks = questions.map((q, i) => {
    const n = i + 1;
    const a = answer.answers[i];
    let ans: string;
    if (!a || a.skipped) {
      ans = "(skipped)";
    } else {
      const picks: string[] = [];
      for (const idx of a.optionIndices) {
        const opt = q.options[idx];
        if (opt) picks.push(opt.label);
      }

      if (a.custom?.trim()) picks.push(a.custom.trim());
      ans = picks.length > 0 ? picks.join(", ") : "(no selection)";
    }
    return `Q${n}: ${q.question}\nA${n}: ${ans}`;
  });
  return blocks.join("\n\n");
}
