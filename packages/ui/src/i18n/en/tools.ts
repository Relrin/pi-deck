/**
 * Strings for `features/tools/`.
 *
 * Tool **ids** and their `label`s in `toolCatalog.ts` are pi's own tool vocabulary — `read`,
 * `bash`, `edit`, `write` — matched by string across the agent layer, so they never localize. The
 * descriptions beside them do.
 *
 * `PidToolsButton.tsx` and `SessionToolsButton.tsx` render the same three strings; they share one
 * key set here rather than carrying a copy each.
 */
const tools = {
  session: {
    title: "Session tools",
    /** Shown on the trigger once some tools are off. */
    titleWithCount: "Session tools ({count:number} off)",
    blurb: "Override for this session only. Settings - Tools sets the default for new sessions.",
  },

  allOffWarning:
    "With every tool disabled, the agent can only reply with text — it can't read or modify files.",

  /** `ToolsList.tsx`'s per-row accessible name. `{tool}` is a tool label and stays as it is. */
  toggle: {
    enabled: "{tool:string}: enabled",
    disabled: "{tool:string}: disabled",
  },

  /** Descriptions for the four built-in tools, keyed by the tool id in `toolCatalog.ts`. */
  catalog: {
    read: "Read files from the project.",
    bash: "Run shell commands.",
    edit: "Modify existing files.",
    write: "Create new files.",
  },

  errors: {
    update: "Failed to update tools",
  },
} as const;

export default tools;
