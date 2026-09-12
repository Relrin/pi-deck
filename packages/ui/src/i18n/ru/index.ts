import { deepMerge } from "../deep-merge.js";
import en from "../en/index.js";
import type { Translation } from "../i18n-types";
import chat from "./chat.js";
import common from "./common.js";
import editor from "./editor.js";
import format from "./format.js";
import git from "./git.js";
import intro from "./intro.js";
import plan from "./plan.js";
import sessions from "./sessions.js";
import settings from "./settings.js";
import terminal from "./terminal.js";

/**
 * Russian catalog.
 *
 * Every namespace here is *partial*. `deepMerge` merges them over the English base, so a
 * half-finished translation still satisfies the generated `Translation` type and any key not yet
 * translated renders its English string rather than a blank or a key path. That per-key fallback
 * is what makes an in-progress locale shippable.
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
  editor,
  format,
  git,
  intro,
  plan,
  sessions,
  settings,
  terminal,
}) as unknown as Translation;

export default ru;
