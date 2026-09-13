import type { BaseTranslation } from "../i18n-types";
import chat from "./chat.js";
import common from "./common.js";
import editor from "./editor.js";
import format from "./format.js";
import git from "./git.js";
import intro from "./intro.js";
import plan from "./plan.js";
import sessions from "./sessions.js";
import settings from "./settings.js";
import shell from "./shell.js";
import terminal from "./terminal.js";

/**
 * The base catalog. Ten namespaces mirroring `features/*`, one file each, so the phased string
 * sweep can run in parallel sessions without every change landing in the same file.
 *
 * NOTE the `.js` specifiers above. The generator transpiles this folder to plain JS in a temp
 * directory and imports it with Node's ESM loader, which needs a real file ending — `.ts` here
 * fails at generate time even though TypeScript would accept it. The *generated* files in this
 * folder use `.ts` instead; that asymmetry is the generator's, not ours.
 */
const en = {
  chat,
  common,
  editor,
  format,
  git,
  intro,
  plan,
  sessions,
  settings,
  shell,
  terminal,
} satisfies BaseTranslation;

export default en;
