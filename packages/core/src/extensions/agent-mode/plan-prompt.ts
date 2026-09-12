/**
 * Plan-mode system prompt assembly. We append a focused "Plan Mode" section to the original
 * system prompt pi-ai built for the turn so the agent keeps its tool descriptions and project
 * context but adopts a planning posture: read-only exploration (including read-only shell
 * commands), structured plan output, and a single durable plan file the renderer can pin.
 *
 * Kept in one place so the wording is reviewable and easy to tune without touching the hook
 * site in `agent-mode.ts`.
 *
 * **Localized in full.** The plan file is something the user reads, edits and commits, so its
 * headings and step labels are translated along with the prose — the vocabulary lives in
 * `i18n/plan-vocabulary.ts`. Two things never translate, in any locale, and every locale must
 * state them explicitly: the GFM checkbox markers `- [ ]` / `- [~]` / `- [x]`, and the leading
 * heading. `parsePlan.ts` and `PlanCard`'s `hasPlanChecklist` gate key off exactly those, so a
 * translation that dropped them would produce a plan the user cannot approve.
 */

import { DEFAULT_LOCALE, type Locale } from "../../i18n/locale.js";
import { PLAN_VOCABULARY, type PlanVocabulary } from "../../i18n/plan-vocabulary.js";

export interface ComposePlanPromptOptions {
  /** Absolute path of the per-session plan file the agent should overwrite. */
  planFilePath: string;
  /** Language the plan is written in. Defaults to English. */
  locale?: Locale;
}

/**
 * Append plan-mode instructions to pi-ai's assembled system prompt. The agent is told to
 * explore via read-only tools and read-only shell commands, produce a single structured plan
 * as its final message, and also overwrite the per-session plan file so the plan survives
 * restarts.
 */
export function composePlanPrompt(originalPrompt: string, opts: ComposePlanPromptOptions): string {
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const vocabulary = PLAN_VOCABULARY[locale];
  const section =
    locale === "ru"
      ? planSectionRu(opts.planFilePath, vocabulary)
      : planSectionEn(opts.planFilePath, vocabulary);
  return `${originalPrompt.trimEnd()}\n\n${vocabulary.header}\n${section}\n`;
}

function planSectionEn(planFilePath: string, v: PlanVocabulary): string {
  return [
    "You are in plan mode. Do not execute mutating commands or edit files this turn —",
    "except for the plan file itself (see below). Other writes will be blocked by the host.",
    "",
    "Use read-only tools (read, grep, glob, web fetch) to research about the problem and prepare",
    "code before you commit to anything. When a decision is genuinely open or ambiguous and",
    "when its possible to offer concrete options (e.g. with code / diff previews) — ask a user",
    "instead of writing the options into the plan or listing them as prose. It renders an interactive ",
    "picker and pauses for the answer, which then steers the plan.",
    "",
    "When the request is clear enough, you MUST save the plan to the file with the write",
    "tool. Any further updates also should be applied and reflected in the plan file. Write " +
      "it to exactly this path (do not invent another filename like `plan.md` or `structure-design.md`):",
    "",
    `  ${planFilePath}`,
    "",
    "Structure the file as GitHub-flavored markdown: first an H1 title line",
    `\`# ${v.titlePlaceholder}\` naming what the plan accomplishes, then these sections in order:`,
    "",
    `  1. **${v.sections.context}** — one or two sentences on why this change.`,
    `  2. **${v.sections.plan}** — a checklist using \`- [ ] **LABEL** — task\` items, one concrete step each.`,
    `     LABEL is a short one- or two-word operation tag in CAPS (e.g. ${v.labels.join(", ")}).`,
    "     The label is optional — write just `- [ ] task` when no tag fits.",
    `  3. **${v.sections.files}** — repo-relative paths with a short note per file.`,
    `  4. **${v.sections.verification}** — how the user (or you, after approval) will confirm it works.`,
    "",
    "Then also present the same plan as your final assistant message so the user can review it",
    "inline. Overwrite the plan file in place whenever you revise — it is the *current* plan.",
    "End the plan file with this execution note, verbatim, so the convention travels with the plan",
    "into execution (the user need not repeat it on approval):",
    "",
    `  ${v.executionNote}`,
    "",
    "After approval you keep working and using the same plan file. As you go, EDIT that existing plan file",
    `(\`${planFilePath}\`) with the edit tool to change each step's \`- [ ]\` → \`- [~]\` (starting)`,
    "→ `- [x]` (done).",
    "",
    `End the message with: "${v.closingLine}"`,
  ].join("\n");
}

/**
 * The Russian section. A translation of the English one rather than a paraphrase — same
 * instructions, same order — so tuning one means tuning the other. Everything it mandates
 * literally (`- [ ]`, `- [~]`, `- [x]`, the H1, the file path) stays byte-identical to the English
 * version, because the renderer parses those, not the model.
 */
function planSectionRu(planFilePath: string, v: PlanVocabulary): string {
  return [
    "Вы в режиме планирования. На этом ходу не выполняйте модифицирующие команды и не редактируйте",
    "файлы, кроме самого файла плана.",
    "",
    "Используй команды только для чтения (read, grep, glob, web fetch), чтобы проанализировать задачу",
    "и подготовить решение, прежде чем что-то выполнять. Если задача действительно неоднозначна и",
    "возможно предложить возможные решения (например, с превью кода или диффа) - спросите",
    "пользователя, вместо того чтобы описывать варианты в плане или перечислять их напрямую. Вопрос",
    "отображается как интерактивный выбор и приостанавливает исполнение до ответа, который затем",
    "определяет план.",
    "",
    "Когда задача ясна, вы ОБЯЗАНЫ сохранить план в файл инструментом write. Все последующие " +
      "правки также должны быть применены к этому файлу. Запись изменений должна происходить исключительно по " +
      "этому пути (не используйте другое имя вроде `plan.md` или `structure-design.md`):",
    "",
    `  ${planFilePath}`,
    "",
    "Подготовь файл в виде GitHub-flavored markdown: начни с заголовка H1",
    `\`# ${v.titlePlaceholder}\`, описывающего, что делает план, затем добавь разделы по порядку:`,
    "",
    `  1. **${v.sections.context}** — одно-два предложения о том, зачем нужно изменение.`,
    `  2. **${v.sections.plan}** — список из пунктов \`- [ ] **МЕТКА** — задача\`, по одному конкретному шагу.`,
    `     МЕТКА — короткий тег операции из одного-двух слов ЗАГЛАВНЫМИ (например, ${v.labels.join(", ")}).`,
    "     Метка необязательна — пишите просто `- [ ] задача`, если подходящего тега нет.",
    `  3. **${v.sections.files}** — пути относительно репозитория с короткой пометкой по каждому файлу.`,
    `  4. **${v.sections.verification}** — как пользователь (или агент после подтверждения) убедится, что всё работает.`,
    "",
    "Затем приведите тот же план в финальном сообщении, чтобы пользователь мог просмотреть его",
    "прямо в чате. При каждой правке перезаписывайте файл плана — в нём всегда *текущий* план.",
    "Завершите файл плана этой пометкой о выполнении, дословно, чтобы оно обновлялось вместе",
    "с планом в стадию выполнения (пользователю не нужно повторять его при подтверждении):",
    "",
    `  ${v.executionNote}`,
    "",
    "После подтверждения вы продолжаете работу с тем же файлом плана. По ходу исполнения РЕДАКТИРУЙТЕ этот",
    `файл (\`${planFilePath}\`) инструментом edit, меняя у каждого шага \`- [ ]\` → \`- [~]\` (начат)`,
    "→ `- [x]` (готово).",
    "",
    `Завершите сообщение фразой: "${v.closingLine}"`,
  ].join("\n");
}
