import { type Static, Type } from "typebox";

/**
 * TypeBox parameter schema for the `ask_user_question` tool - this is what the model fills in.
 * It is deliberately our *own*, presentation-agnostic shape (content + semantics only, no
 * layout/pixel fields) so the same payload can be rendered by the pi-deck GUI today or a TUI.
 *
 * The wire/runtime question shape is defined once as Zod in `protocol/events.ts`
 * (`AskUserQuestionSchema`); a runtime test keeps the two in lock-step.
 */
const AskUserOptionParams = Type.Object(
  {
    id: Type.Optional(Type.String({ description: "Optional stable id for the option." })),
    label: Type.String({ description: "Short option label shown to the user." }),
    description: Type.Optional(
      Type.String({ description: "One-line explanation of what this option means or does." }),
    ),
    preview: Type.Optional(
      Type.String({
        description:
          "Optional preview of the concrete change this option makes - ONLY a fenced code or " +
          "diff block (```lang ... ```). It opens a side-by-side code pane. Do NOT put prose " +
          "trade-offs here (those go in `description`); a non-code preview is ignored.",
      }),
    ),
  },
  { additionalProperties: false },
);

const AskUserQuestionParams = Type.Object(
  {
    id: Type.Optional(Type.String({ description: "Optional stable id for the question." })),
    header: Type.String({ description: "Very short section/tab label, e.g. 'Theme strategy'." }),
    question: Type.String({ description: "The question to put to the user." }),
    options: Type.Array(AskUserOptionParams, {
      minItems: 2,
      maxItems: 4,
      description: "Two to four options the user can pick from.",
    }),
    multiSelect: Type.Optional(
      Type.Boolean({ description: "Allow selecting several options (checkbox list)." }),
    ),
    allowCustom: Type.Optional(
      Type.Boolean({ description: "Offer a free-text 'Something else' answer." }),
    ),
    minSelect: Type.Optional(
      Type.Number({ description: "Minimum selections for a multiSelect question." }),
    ),
    maxSelect: Type.Optional(
      Type.Number({ description: "Maximum selections for a multiSelect question." }),
    ),
  },
  { additionalProperties: false },
);

export const AskUserToolParams = Type.Object(
  {
    questions: Type.Array(AskUserQuestionParams, {
      minItems: 1,
      maxItems: 4,
      description:
        "One to four questions to put to the user. Use a single question for a focused " +
        "decision; use several to gather a few related choices at once (e.g. while planning).",
    }),
  },
  { additionalProperties: false },
);

export type AskUserToolInput = Static<typeof AskUserToolParams>;
