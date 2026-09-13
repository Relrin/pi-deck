import type { BaseTranslation } from "../i18n-types";
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
 * The base catalog. One namespace per `features/*` directory, one file each, so the phased string
 * sweep can run in parallel sessions without every change landing in the same file. A key's first
 * segment always equals the file it lives in; `i18n-check.ts` enforces that.
 *
 * Two features share rather than own a namespace, and both are deliberate: `features/review/`
 * renders inside the chat column and keys under `chat.review`, and `features/plan-panel/` keys
 * under `plan.panel`.
 *
 * NOTE the `.js` specifiers above. The generator transpiles this folder to plain JS in a temp
 * directory and imports it with Node's ESM loader, which needs a real file ending — `.ts` here
 * fails at generate time even though TypeScript would accept it. The *generated* files in this
 * folder use `.ts` instead; that asymmetry is the generator's, not ours.
 */
const en = {
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
} satisfies BaseTranslation;

export default en;
