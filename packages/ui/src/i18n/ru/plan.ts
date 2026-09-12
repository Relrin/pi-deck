import type { DeepPartial } from "../deep-merge";
import type { Translation } from "../i18n-types";

/**
 * Russian overrides for the `plan` namespace. Deliberately partial — anything omitted falls back
 * to the English string, per key, via `deepMerge` in `./index.ts`.
 *
 * The checkbox markers in `continuation` stay exactly as they are in English. `parsePlan.ts` and
 * `PlanCard`'s `hasPlanChecklist` gate match on those literal characters, so translating them
 * would leave the user with a plan they cannot approve.
 */
const plan = {
  continuation:
    "План подтвержден — приступайте к выполнению. В процессе работы редактируйте файл плана, меняя чекбокс каждого шага (`[ ]`→`[~]`→`[x]`), чтобы отражать прогресс.",

  comments: {
    leadIn: "У меня есть комментарии к плану:",
    closing: "Пожалуйста, доработайте план с их учётом и оставайтесь в режиме планирования.",
  },

  panel: {
    inProgressFallback: "в процессе",
  },
} as const satisfies DeepPartial<Translation["plan"]>;

export default plan;
