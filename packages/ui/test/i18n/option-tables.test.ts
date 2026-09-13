import { describe, expect, test } from "bun:test";
import { modeEntries } from "../../src/features/chat/composer/SessionAgentModePicker";
import { effortLevels } from "../../src/features/chat/composer/SessionEffortPicker";
import { targetModes } from "../../src/features/chat/messages/PlanCard";
import { thinkingLevels } from "../../src/features/chat/ThinkingLevelPicker";
import { lineDiffOptions } from "../../src/features/diff/DiffToolbar";
import { encodingOptions, eolOptions } from "../../src/features/editor/PidEditorStatus";
import { groupModeOptions } from "../../src/features/git/GroupModeMenu";
import { agentModes } from "../../src/features/intro/PidAgentModePicker";
import { effortLevelOptions } from "../../src/features/intro/PidEffortPicker";
import { providerStateLabels } from "../../src/features/models/ProviderList";
import { statusLabels } from "../../src/features/sessions/PidSessionRow";
import {
  groupOptions,
  sinceOptions,
  sortOptions,
} from "../../src/features/sessions/SessionsFilterPopover";
import { navItems } from "../../src/features/settings/PidSettingsView";
import {
  densityOptions,
  fontOptions,
  terminalWidthOptions,
  viewOptions,
} from "../../src/features/settings/sections/AppearanceSection";
import {
  diffIndicatorOptions,
  diffLayoutOptions,
  diffLineDiffOptions,
} from "../../src/features/settings/sections/GitGitHubSection";
import {
  idleOptions,
  lifecycleOptions,
} from "../../src/features/settings/sections/McpServersSection";
import {
  agentModeOptions,
  effortOptions,
} from "../../src/features/settings/sections/ProvidersSection";
import { cwdOptions } from "../../src/features/settings/sections/TerminalSection";
import { planGateOptions } from "../../src/features/settings/sections/ToolsSection";
import { builtInTools } from "../../src/features/tools/toolCatalog";
import type { TranslationFunctions } from "../../src/i18n/i18n-types";

/**
 * The ratchet for the most-repeated transformation in the i18n work.
 *
 * A module-level `const OPTIONS = [{ value, label }]` is evaluated once at import and freezes
 * whatever locale happened to be loaded then — the bug is silent, because the app renders correct
 * English and only goes stale on a language switch. Every such table is therefore a function
 * taking the translations, and this file proves it by calling each one with a sentinel: any label
 * that comes back as something other than the sentinel was baked in at import time.
 *
 * A Russian probe could not do this job — `ru` is a partial catalog that falls back to English per
 * key, so a label that never reached the catalog at all would look identical to one that did.
 * Adding a new option table costs one line here.
 */

const SENTINEL = "§";

/**
 * Stands in for `TranslationFunctions`: every property is another node, and calling any node
 * yields the sentinel. The target is a function so the proxy itself stays callable at any depth.
 */
function sentinelTranslations(): TranslationFunctions {
  const node: unknown = new Proxy(() => SENTINEL, {
    get: (_target, prop) => (prop === "then" ? undefined : node),
    apply: () => SENTINEL,
  });
  return node as TranslationFunctions;
}

const t = sentinelTranslations();

/** Every table, as `[name, labels, other translated fields]`. */
const TABLES: ReadonlyArray<readonly [string, readonly string[], readonly string[]]> = [
  ["navItems", navItems(t).map((o) => o.label), []],
  ["viewOptions", viewOptions(t).map((o) => o.label), []],
  ["densityOptions", densityOptions(t).map((o) => o.label), []],
  ["fontOptions", fontOptions(t).map((o) => o.label), []],
  ["terminalWidthOptions", terminalWidthOptions(t).map((o) => o.label), []],
  ["cwdOptions", cwdOptions(t).map((o) => o.label), []],
  [
    "planGateOptions",
    planGateOptions(t).map((o) => o.label),
    planGateOptions(t).map((o) => o.description ?? SENTINEL),
  ],
  ["effortOptions", effortOptions(t).map((o) => o.label), []],
  [
    "agentModeOptions",
    agentModeOptions(t).map((o) => o.label),
    agentModeOptions(t).map((o) => o.description ?? SENTINEL),
  ],
  [
    "diffIndicatorOptions",
    diffIndicatorOptions(t).map((o) => o.label),
    diffIndicatorOptions(t).map((o) => o.description),
  ],
  [
    "diffLayoutOptions",
    diffLayoutOptions(t).map((o) => o.label),
    diffLayoutOptions(t).map((o) => o.description),
  ],
  [
    "diffLineDiffOptions",
    diffLineDiffOptions(t).map((o) => o.label),
    diffLineDiffOptions(t).map((o) => o.description),
  ],
  [
    "lifecycleOptions",
    lifecycleOptions(t).map((o) => o.label),
    lifecycleOptions(t).map((o) => o.hint),
  ],
  ["idleOptions", idleOptions(t).map((o) => o.label), []],
  ["modeEntries", modeEntries(t).map((o) => o.label), modeEntries(t).map((o) => o.blurb)],
  ["effortLevels", effortLevels(t).map((o) => o.label), []],
  ["thinkingLevels", thinkingLevels(t).map((o) => o.label), []],
  ["targetModes", targetModes(t).map((o) => o.label), targetModes(t).map((o) => o.blurb)],
  ["agentModes", agentModes(t).map((o) => o.label), agentModes(t).map((o) => o.blurb)],
  ["effortLevelOptions", effortLevelOptions(t).map((o) => o.label), []],
  ["sortOptions", sortOptions(t).map((o) => o.label), []],
  ["groupOptions", groupOptions(t).map((o) => o.label), []],
  ["statusLabels", Object.values(statusLabels(t)), []],
  ["providerStateLabels", Object.values(providerStateLabels(t)), []],
  ["builtInTools", builtInTools(t).map((o) => o.description), []],
  ["encodingOptions", encodingOptions(t).map((o) => o.label), []],
  ["eolOptions", eolOptions(t).map((o) => o.hint), []],
  [
    "lineDiffOptions",
    lineDiffOptions(t).map((o) => o.label),
    lineDiffOptions(t).map((o) => o.description),
  ],
  [
    "groupModeOptions",
    groupModeOptions(t).map((o) => o.label),
    groupModeOptions(t).map((o) => o.description),
  ],
];

describe("option tables", () => {
  test.each(
    TABLES,
  )("%s resolves its copy from the catalog, not a literal", (_name, labels, rest) => {
    expect(labels.length).toBeGreaterThan(0);
    for (const label of [...labels, ...rest]) expect(label).toBe(SENTINEL);
  });

  /**
   * The other half of the contract: the `value` fields are pi's protocol values or persisted
   * preference keys, and translating one would silently break the setting it drives.
   */
  test("value fields stay identifiers", () => {
    expect(navItems(t).map((o) => o.id)).toEqual([
      "appearance",
      "agent-models",
      "tools",
      "skills",
      "mcp-servers",
      "editor",
      "git-github",
      "terminal",
    ]);
    expect(agentModeOptions(t).map((o) => o.value)).toEqual([
      "ask",
      "accept-edits",
      "auto",
      "plan",
    ]);
    expect(modeEntries(t).map((o) => o.value)).toEqual(["ask", "accept-edits", "auto", "plan"]);
    expect(targetModes(t).map((o) => o.value)).toEqual(["ask", "accept-edits", "auto"]);
    expect(thinkingLevels(t).map((o) => o.id)).toEqual([
      "off",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
    ]);
    expect(lifecycleOptions(t).map((o) => o.value)).toEqual(["lazy", "eager", "keep-alive"]);
    expect(planGateOptions(t).map((o) => o.value)).toEqual(["approve", "block"]);
    expect(densityOptions(t).map((o) => o.value)).toEqual(["compact", "cozy"]);
    expect(fontOptions(t).map((o) => o.value)).toEqual(["default", "sans-only", "mono-only"]);
    expect(viewOptions(t).map((o) => o.value)).toEqual(["agent", "ide"]);
    expect(terminalWidthOptions(t).map((o) => o.value)).toEqual([
      "center-left",
      "center",
      "center-right",
      "all",
    ]);
    expect(cwdOptions(t).map((o) => o.value)).toEqual(["session", "last-used"]);
    expect(idleOptions(t).map((o) => o.value)).toEqual([5, 10, 30, 0]);
    expect(diffIndicatorOptions(t).map((o) => o.value)).toEqual(["bars", "classic", "none"]);
    expect(diffLayoutOptions(t).map((o) => o.value)).toEqual(["split", "unified"]);
    expect(diffLineDiffOptions(t).map((o) => o.value)).toEqual([
      "word-alt",
      "word",
      "char",
      "none",
    ]);
    expect(groupModeOptions(t).map((o) => o.value)).toEqual(["file", "hunk", "change", "folder"]);
    expect(lineDiffOptions(t).map((o) => o.value)).toEqual(["word-alt", "word", "char", "none"]);
    expect(encodingOptions(t).map((o) => o.name)).toEqual([
      "utf-8",
      "utf-16le",
      "utf-16be",
      "win1252",
      "latin1",
      "ascii",
    ]);
    // `label` here is the separator name itself, not copy — only `hint` comes from the catalog.
    expect(eolOptions(t).map((o) => o.value)).toEqual(["lf", "crlf"]);
    expect(eolOptions(t).map((o) => o.label)).toEqual(["LF", "CRLF"]);
    // Tool ids AND labels are pi vocabulary: `id` is what we send as `excludeTools`, and `label`
    // is deliberately identical to it. Only the description comes from the catalog.
    expect(builtInTools(t).map((o) => o.id)).toEqual(["read", "bash", "edit", "write"]);
    expect(builtInTools(t).map((o) => o.label)).toEqual(["read", "bash", "edit", "write"]);
    expect(agentModes(t).map((o) => o.value)).toEqual(["ask", "accept-edits", "auto", "plan"]);
    expect(effortLevelOptions(t).map((o) => o.value)).toEqual(["low", "medium", "high"]);
    expect(sortOptions(t).map((o) => o.id)).toEqual(["recent", "created", "branch", "status"]);
    expect(groupOptions(t).map((o) => o.id)).toEqual(["workspace", "branch", "status", "flat"]);
    // `since` is mostly durations, which are not copy — only the `all` row resolves from the
    // catalog, so the table is asserted on its ids rather than added to the sentinel sweep above.
    expect(sinceOptions(t).map((o) => o.id)).toEqual(["1d", "7d", "14d", "30d", "all"]);
    expect(
      sinceOptions(t)
        .slice(0, 4)
        .map((o) => o.label),
    ).toEqual(["1d", "7d", "14d", "30d"]);
    expect(Object.keys(statusLabels(t))).toEqual(["working", "waiting", "done", "failed"]);
    expect(Object.keys(providerStateLabels(t))).toEqual([
      "authenticated",
      "needs-key",
      "unreachable",
    ]);
  });
});
