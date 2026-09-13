/**
 * Strings for the app shell (`layout/`) and the shared UI primitives (`components/`).
 *
 * These two directories mirror no feature, which is why they get a namespace of their own rather
 * than being folded into `common` — `common` is shared *vocabulary* (Cancel, Close, the host-error
 * table), not a catch-all.
 *
 * Almost everything here is an `aria-label` or a tooltip. What is deliberately absent:
 * `components/kbd/PidKbd.tsx`'s key names and `lib/platform.ts`'s modifier glyphs are matched
 * against `KeyboardEvent.key` or printed on physical keyboards, and `components/glyph/kinds.tsx`
 * holds icon identifiers — none of those are copy.
 */
const shell = {
  topBar: {
    backToStart: "Back to start",
    leftPanel: {
      show: "Show left panel",
      hide: "Hide left panel",
    },
    bottomPanel: {
      show: "Show bottom panel",
      hide: "Hide bottom panel",
    },
    rightPanel: {
      show: "Show right panel",
      hide: "Hide right panel",
    },
  },

  /** Shared by the top bar and the left-rail footer, which render the same two affordances. */
  settings: {
    open: "Open settings",
    /** `mod` is the platform modifier glyph from `lib/platform.ts` — a key name, never translated. */
    shortcutTooltip: "Settings ({mod:string}+,)",
  },

  terminal: {
    toggle: "Toggle terminal panel",
    shortcutTooltip: "Toggle terminal ({mod:string}+`)",
  },

  leftRail: {
    label: "Left rail",
    tabs: "Left rail tabs",
    sessions: "Sessions",
    files: "Files",
  },

  rightPane: {
    label: "Right pane",
    tabs: "Right pane tabs",
    session: "Session",
    git: "Git",
    context: "Context",
  },

  /**
   * The four screen labels render uppercase inside a fixed-width toolbar. Their Russian
   * equivalents run 1.5–2× wider — flagged for the phase 08 overflow audit, not fixed here.
   */
  screenSwitcher: {
    label: "Switch screen",
    sessionGate: "Open a session first",
    session: "SESSION",
    editor: "EDITOR",
    diff: "DIFF",
    blank: "BLANK",
  },

  resize: {
    leftRail: "Resize left rail",
    rightPane: "Resize right pane",
    terminalPanel: "Resize terminal panel",
  },

  windowControls: {
    minimize: "Minimize",
    maximize: "Maximize",
    restore: "Restore",
  },

  footer: {
    screen: "screen",
  },

  sessionPane: {
    loading: "Loading session…",
  },

  components: {
    confirmDialog: {
      confirm: "Confirm",
    },
    stepper: {
      /** `label` is the control's own `ariaLabel`, e.g. "font size". */
      increase: "Increase {label:string}",
      decrease: "Decrease {label:string}",
      /** Used when the stepper was given no `ariaLabel` to qualify the direction with. */
      increaseBare: "Increase",
      decreaseBare: "Decrease",
    },
    chipPicker: {
      header: "Select",
    },
  },
} as const;

export default shell;
