/**
 * Strings for `features/terminal/`.
 *
 * Shell kinds (`powershell`, `zsh`, `wsl`) and the font names in `terminalFonts.ts` are process
 * and family names, not copy. The `[output throttled]` hint is written into the PTY byte stream by
 * `packages/core/src/terminal/buffer.ts` and stays English — a documented island.
 */
const terminal = {
  /** `NewTerminalButton.tsx`. */
  new: {
    label: "New terminal",
    chooseType: "Choose terminal type",
    noShells: "No shells detected",
    defaultBadge: "default",
    settings: "Terminal settings…",
  },

  /** `TerminalTabs.tsx`. `{name}` is the tab's label, which the user can rename. */
  tabs: {
    label: "Terminal tabs",
    rename: "Rename terminal",
    close: "Close {name:string}",
    closePanel: "Close terminal panel",
  },

  /** `TerminalView.tsx` / `TerminalPane.tsx`. */
  view: {
    exited: "Process exited",
    restart: "Restart",
    starting: "Starting terminal…",
    noProject: "Open a project to start a terminal.",
  },
} as const;

export default terminal;
