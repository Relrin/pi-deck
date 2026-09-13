import { deepMerge } from "../deep-merge.js";
import en from "../en/index.js";
import type { Translation } from "../i18n-types";
import chat from "./chat.js";
import common from "./common.js";
import context from "./context.js";
import diff from "./diff.js";
import editor from "./editor.js";
import files from "./files.js";
import format from "./format.js";
import git from "./git.js";
import intro from "./intro.js";
import models from "./models.js";
import plan from "./plan.js";
import sessions from "./sessions.js";
import settings from "./settings.js";
import shell from "./shell.js";
import terminal from "./terminal.js";
import tools from "./tools.js";

/**
 * Russian catalog.
 *
 * Every namespace here is *partial*. `deepMerge` merges them over the English base, so a
 * half-finished translation still satisfies the generated `Translation` type and any key not yet
 * translated renders its English string rather than a blank or a key path. That per-key fallback
 * is what makes an in-progress locale shippable.
 *
 * ## Register
 *
 * Match the English: terse, imperative, lower-case where the English is lower-case. Prefer
 * established Russian IT usage over literal translation — this is a developer tool, and a
 * developer who reads `коммит` daily is not helped by `фиксация`.
 *
 * ## Plurals
 *
 * **Six slots, always**, in the order `zero|one|two|few|many|other`. The parser reads them
 * positionally, so a group of four or five leaves `many` and `other` undefined and renders an
 * *empty word* — `5 файлов` comes out as `5 `. Russian has four CLDR categories but needs six
 * catalog slots; those are different things. Given the three real forms S1/S2/S5, write
 * `{{S5|S1|S2|S2|S5|S5}}`. `two` never selects in Russian but must still carry text.
 * `i18n-check.ts` makes a wrong count fatal.
 *
 * ## Glossary
 *
 * One word per concept, everywhere. Inconsistency is the most visible translation defect, and
 * these recur in every namespace.
 *
 * | en | ru | note |
 * | -- | -- | ---- |
 * | session | сессия | not `сеанс` |
 * | project | проект | |
 * | plan | план | |
 * | turn | ход | one agent turn |
 * | tool call | вызов инструмента | |
 * | approve / deny | разрешить / отклонить | set by all 22 `chat.approval.reason.*` |
 * | commit | коммит | noun and verb (`закоммитить`) |
 * | branch | ветка | |
 * | stash | стеш | verb `застешить` |
 * | stage / unstage | индексировать / убрать из индекса | |
 * | diff | дифф | |
 * | revert | откатить | |
 * | push / pull | запушить / запулить | |
 * | rail | панель | left and right rails: `левая/правая панель` |
 * | pane | панель | disambiguate by side; a docked one is `док` |
 * | provider | провайдер | |
 * | model | модель | |
 * | skill | навык | |
 * | attachment | вложение | |
 * | template | шаблон | |
 * | language server | языковой сервер | |
 * | diagnostics | диагностика | |
 * | file tree | дерево файлов | |
 *
 * ## Never translated
 *
 * Provider and model names, theme names, tool ids, the language labels in the editor status bar,
 * font names, language-server ids and their `npm install -g …` hints, file paths, git refs and
 * branch names, MCP server names, the shell commands embedded in `git.notify.push.reason.*`, and
 * the `pull --rebase` action label. When a sentence wraps one of these, translate the sentence and
 * leave the token exactly as it is.
 *
 * This is our own merge rather than typesafe-i18n's `extendDictionary`, which is shallow — see
 * `deep-merge.ts`.
 *
 * The cast bridges two spellings of the same strings. The base catalog declares parameter types
 * inline (`{tool:string}`), which is how the generator learns them; the generated `Translation`
 * type describes the runtime form (`{tool}`). Both are correct and the runtime parser accepts
 * either, but they are not assignable to one another, and the merge result inherits the base
 * catalog's spelling. The individual `ru/*.ts` files are type-checked against the catalog shape on
 * their own, which is where a real mistake would show up.
 */
const ru = deepMerge(en, {
  chat,
  common,
  context,
  diff,
  editor,
  files,
  format,
  git,
  intro,
  models,
  plan,
  sessions,
  settings,
  shell,
  terminal,
  tools,
}) as unknown as Translation;

export default ru;
