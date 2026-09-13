import { describe, expect, test } from "bun:test";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import { llFor } from "../../src/i18n/t";

loadLocale("ru");

const en = llFor("en");
const ru = llFor("ru");

/**
 * A length budget for the labels that render into **fixed-width chrome**.
 *
 * There is no layout engine here to ask. happy-dom returns 0 from `offsetWidth`, `scrollWidth` and
 * `getBoundingClientRect()`, so the obvious test — "assert the label does not overflow its
 * container" — is unwritable in this suite, and any attempt at one silently passes. Do not spend
 * an afternoon on it.
 *
 * So the check moves upstream, from pixels to characters. These particular strings sit in controls
 * that cannot grow: a 9px uppercase footer toolbar, a segmented row inside a settings card, a rail
 * whose floor is 200px. A translation roughly the length of the English one will fit wherever the
 * English one did; one that is three times longer will not, and that is what this catches — early,
 * and pointing at the key rather than at a screenshot.
 *
 * The budget is generous on purpose. Russian averages ~1.15× English, but short labels blow out
 * much further (`VIEW MODE` → `РЕЖИМ ОТОБРАЖЕНИЯ` is 1.9×), and the point is to catch the
 * 30-character label written for a 9px button, not to police ordinary expansion.
 */
function budget(english: string): number {
  // The floor matters as much as the ratio. `All` is three characters and no Russian equivalent
  // is shorter than five, so a pure ratio would fail every short label on arithmetic rather than
  // on fit. Nothing in the app is narrow enough that twelve characters overflow it.
  return Math.max(Math.ceil(english.length * 1.6) + 2, 12);
}

/** `[label, english, translated]` for every string that lands in a size-constrained control. */
const CONSTRAINED: ReadonlyArray<readonly [string, string, string]> = [
  // The screen switcher: uppercase, 9px, letter-spaced, in the footer's fixed row.
  [
    "shell.screenSwitcher.session",
    en.shell.screenSwitcher.session(),
    ru.shell.screenSwitcher.session(),
  ],
  [
    "shell.screenSwitcher.editor",
    en.shell.screenSwitcher.editor(),
    ru.shell.screenSwitcher.editor(),
  ],
  ["shell.screenSwitcher.diff", en.shell.screenSwitcher.diff(), ru.shell.screenSwitcher.diff()],
  ["shell.screenSwitcher.blank", en.shell.screenSwitcher.blank(), ru.shell.screenSwitcher.blank()],

  // The six `pid-segmented` radiogroups. They wrap now, but a single option wider than its card
  // still clips.
  [
    "settings.appearance.view.agent",
    en.settings.appearance.view.agent(),
    ru.settings.appearance.view.agent(),
  ],
  [
    "settings.appearance.view.ide",
    en.settings.appearance.view.ide(),
    ru.settings.appearance.view.ide(),
  ],
  [
    "settings.appearance.density.compact",
    en.settings.appearance.density.compact(),
    ru.settings.appearance.density.compact(),
  ],
  [
    "settings.appearance.density.cozy",
    en.settings.appearance.density.cozy(),
    ru.settings.appearance.density.cozy(),
  ],
  [
    "settings.appearance.fonts.sansOnly",
    en.settings.appearance.fonts.sansOnly(),
    ru.settings.appearance.fonts.sansOnly(),
  ],
  [
    "settings.appearance.fonts.monoOnly",
    en.settings.appearance.fonts.monoOnly(),
    ru.settings.appearance.fonts.monoOnly(),
  ],
  [
    "settings.appearance.terminalWidth.centerLeft",
    en.settings.appearance.terminalWidth.centerLeft(),
    ru.settings.appearance.terminalWidth.centerLeft(),
  ],
  [
    "settings.appearance.terminalWidth.center",
    en.settings.appearance.terminalWidth.center(),
    ru.settings.appearance.terminalWidth.center(),
  ],
  [
    "settings.appearance.terminalWidth.centerRight",
    en.settings.appearance.terminalWidth.centerRight(),
    ru.settings.appearance.terminalWidth.centerRight(),
  ],
  [
    "settings.appearance.terminalWidth.all",
    en.settings.appearance.terminalWidth.all(),
    ru.settings.appearance.terminalWidth.all(),
  ],
  [
    "settings.terminal.cwd.session",
    en.settings.terminal.cwd.session(),
    ru.settings.terminal.cwd.session(),
  ],
  [
    "settings.terminal.cwd.lastUsed",
    en.settings.terminal.cwd.lastUsed(),
    ru.settings.terminal.cwd.lastUsed(),
  ],

  // The settings nav list, against the 200px left-rail floor.
  ["settings.nav.appearance", en.settings.nav.appearance(), ru.settings.nav.appearance()],
  ["settings.nav.agentModels", en.settings.nav.agentModels(), ru.settings.nav.agentModels()],
  ["settings.nav.tools", en.settings.nav.tools(), ru.settings.nav.tools()],
  ["settings.nav.skills", en.settings.nav.skills(), ru.settings.nav.skills()],
  ["settings.nav.mcpServers", en.settings.nav.mcpServers(), ru.settings.nav.mcpServers()],
  ["settings.nav.editor", en.settings.nav.editor(), ru.settings.nav.editor()],
  ["settings.nav.gitGithub", en.settings.nav.gitGithub(), ru.settings.nav.gitGithub()],
  ["settings.nav.terminal", en.settings.nav.terminal(), ru.settings.nav.terminal()],

  // Rail and pane tabs.
  ["shell.leftRail.sessions", en.shell.leftRail.sessions(), ru.shell.leftRail.sessions()],
  ["shell.leftRail.files", en.shell.leftRail.files(), ru.shell.leftRail.files()],
  ["shell.rightPane.session", en.shell.rightPane.session(), ru.shell.rightPane.session()],
  ["shell.rightPane.git", en.shell.rightPane.git(), ru.shell.rightPane.git()],
  ["shell.rightPane.context", en.shell.rightPane.context(), ru.shell.rightPane.context()],

  // Uppercase, letter-spaced chips capped at 22ch by `components.css`.
  [
    "chat.effortPicker.adaptiveChip",
    en.chat.effortPicker.adaptiveChip(),
    ru.chat.effortPicker.adaptiveChip(),
  ],
  [
    "settings.mcp.chip.projectFile",
    en.settings.mcp.chip.projectFile(),
    ru.settings.mcp.chip.projectFile(),
  ],
  ["context.tag.file", en.context.tag.file(), ru.context.tag.file()],
  ["context.tag.folder", en.context.tag.folder(), ru.context.tag.folder()],
  ["context.tag.repoRef", en.context.tag.repoRef(), ru.context.tag.repoRef()],
];

describe("label budget for fixed-width chrome", () => {
  test.each(
    CONSTRAINED.map((row) => [...row]),
  )("%s fits its control", (_key, english, translated) => {
    expect({
      length: String(translated).length,
      within: String(translated).length <= budget(String(english)),
    }).toEqual({ length: String(translated).length, within: true });
  });

  test("the chip cap in components.css is wide enough for every chip", () => {
    // `.pid-chip` sets `max-width: 22ch`. A chip longer than that ellipsizes rather than
    // overflowing — acceptable, but worth knowing about, so the budget above is the real gate and
    // this only pins the constant the CSS and the budget agree on.
    const CHIP_CAP = 22;
    const chips = [ru.chat.effortPicker.adaptiveChip(), ru.settings.mcp.chip.projectFile()];
    for (const chip of chips) expect(String(chip).length).toBeLessThanOrEqual(CHIP_CAP);
  });
});
