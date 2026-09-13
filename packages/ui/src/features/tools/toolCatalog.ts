import type { TranslationFunctions } from "../../i18n/i18n-types.js";

/**
 * Built-in pi-coding-agent tools we expose in the toggle UI.
 *
 * pi-coding-agent's default-on built-in set per `CreateAgentSessionOptions.tools` docstring
 * is `read, bash, edit, write`.
 *
 * The id MUST match pi's tool name verbatim — it's what we send as `excludeTools`, and `label`
 * is deliberately identical to it: both are pi's tool vocabulary, not copy. Only `description`
 * is, which is why the table is a builder rather than a constant — a module-level one would
 * capture whatever locale was loaded at import time and never update on a language switch.
 */
export interface ToolDescriptor {
  id: string;
  label: string;
  description: string;
}

/** Exported for `test/i18n/option-tables.test.ts`. */
export function builtInTools(t: TranslationFunctions): readonly ToolDescriptor[] {
  const copy = t.tools.catalog;
  return [
    { id: "read", label: "read", description: copy.read() },
    { id: "bash", label: "bash", description: copy.bash() },
    { id: "edit", label: "edit", description: copy.edit() },
    { id: "write", label: "write", description: copy.write() },
  ];
}

/** Ids alone, safe as a constant — they are protocol values and carry no copy. */
export const BUILT_IN_TOOL_IDS: readonly string[] = ["read", "bash", "edit", "write"];
