/**
 * Strings for `features/context/`.
 *
 * `tok` is the unit suffix after an already-formatted token count, so it is its own key rather
 * than part of each sentence. File paths shown in the scope and artefact lists are data.
 */
const context = {
  empty: "Start or open a session to see context.",

  window: {
    label: "context window",
    /** `{used}` and `{total}` arrive pre-formatted (`128K`), so no plural applies. */
    totals: "{used:string} / {total:string} tok",
    usage: "Context usage {percent:number}%",
    /** Legend entries, in bar order. `mcp` gains a ` · N` suffix when servers are connected. */
    legend: {
      system: "system",
      project: "project",
      chat: "chat",
      tools: "tools",
      mcp: "mcp",
      free: "free",
    },
    /** Per-segment tooltips. `{tokens}` is pre-formatted. */
    tooltip: {
      system: "System prompt — {tokens:string} tok",
      project: "Project context (AGENTS.md, CLAUDE.md, etc.) — {tokens:string} tok",
      messages: "Messages — {tokens:string} tok",
      tools: "Skills / tool definitions — {tokens:string} tok",
      mcp: "MCP tools — {tokens:string} tok",
      free: "Free space — {tokens:string} tok",
    },
  },

  scope: {
    label: "in scope · {count:number}",
    empty: "No files or folders attached yet. Drag from the file tree to share context with pi.",
  },

  artefacts: {
    label: "artefacts produced · {count:number}",
    empty:
      "Nothing produced yet. New files the agent writes (plans, reports, generated code…) will appear here.",
  },

  /** Row chips, keyed by `PromptAttachment["kind"]`. */
  tag: {
    file: "file",
    folder: "dir",
    repoRef: "ref",
  },

  row: {
    openTitle: "Open with default app",
    open: "Open {path:string}",
    revealTitle: "Reveal in file manager",
    reveal: "Reveal {path:string} in file manager",
  },

  errors: {
    openUnsupported: "Opening files is not supported on this platform.",
    openFailed: "Failed to open file",
    revealUnsupported: "Reveal in file manager is not supported here.",
    revealFailed: "Failed to reveal file",
  },
} as const;

export default context;
