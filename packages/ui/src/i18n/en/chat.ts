/** Strings for `features/chat/`. Phase 06 fills in the rest of the surface. */
const chat = {
  /**
   * Approval-pill reasons, keyed by `ApprovalReason.code` from
   * `packages/core/src/i18n/approval-reasons.ts`.
   *
   * These are read by the *user* and never by the model, which is what makes them translatable.
   * The model-facing block and deny reasons stay English permanently and live in
   * `extensions/agent-mode/decision.ts` — do not add them here.
   */
  approval: {
    reason: {
      plan: {
        shellNotReadOnly:
          "Plan mode: this shell command isn't read-only — allow it to run, or deny to keep planning.",
        mutatingOperation:
          "Plan mode: this operation can change files or reach outside the workspace — allow it, or deny to keep planning.",
      },
      acceptEdits: {
        outsideAllowlist: "Edit target outside the auto-approve allowlist.",
      },
      auto: {
        mcpTool:
          "Auto mode: run MCP tool {tool:string}? It runs outside the workspace and can't be safety-checked — allow it, or deny to skip.",
        forkBomb: "Auto mode: this looks like a fork bomb — allow it, or deny to stop.",
        blockDeviceRedirect:
          "Auto mode: this redirects output onto a block device, which can destroy a disk — allow it, or deny.",
        recursiveDelete:
          "Auto mode: this deletes files recursively or targets a broad path — allow it, or deny to stop.",
        windowsDelete:
          "Auto mode: this recursively deletes or formats files — allow it, or deny to stop.",
        filesystemDestroy: "Auto mode: this can destroy a filesystem — allow it, or deny to stop.",
        deviceWrite:
          "Auto mode: `dd` is writing to a device/file, which can be destructive — allow it, or deny.",
        permissionSweep:
          "Auto mode: this recursively changes permissions/ownership over a broad path — allow it, or deny.",
        privilegeEscalation:
          "Auto mode: this runs with elevated privileges — allow it, or deny to stop.",
        powerControl: "Auto mode: this powers off or reboots the machine — allow it, or deny.",
        killAll: "Auto mode: this signals every process — allow it, or deny to stop.",
        rawNetwork:
          "Auto mode: this opens a raw network connection that could exfiltrate data — allow it, or deny.",
        upload: "Auto mode: this uploads data to a remote server — allow it, or deny to stop.",
        remoteCopy: "Auto mode: this copies files to a remote host — allow it, or deny to stop.",
        secretOverNetwork:
          "Auto mode: this sends a secret/credential file over the network — allow it, or deny.",
        pipeToShell:
          "Auto mode: this pipes downloaded content into a shell/interpreter (remote code execution) — allow it, or deny.",
        writeSecret:
          "Auto mode: this writes to a secret/credential file — allow it, or deny to stop.",
        writeGitDir:
          "Auto mode: this writes inside the `.git` directory — allow it, or deny to stop.",
        writeOutsideProject:
          "Auto mode: this writes to a path outside the project — allow it, or deny to stop.",
      },
    },
  },

  composer: {
    /** `@`, `/` and `!` are the trigger characters and must survive translation verbatim. */
    placeholder: "Send a message…  @ files · / commands · ! shell",
    ariaLabel: "Message",
    send: "Send",
    sendAria: "Send message",
    sendTooltip: "Send message · Enter",
    stop: "Stop",
    stopAria: "Stop generating",
    stopTooltip: "Stop generating · Esc",
    forceStop: "Force stop",
    forceStopTooltip: "Agent is still running — kill it and end the turn",
    /** `path` and `name` are the user's own file names. */
    removeAttachment: "Remove {path:string}",
    previewImage: "Preview {name:string}",
    removeImage: "Remove {name:string}",
  },

  approvalPill: {
    alwaysAllowTooltip: "Allow this command for the rest of the session",
    /** `key` is the derived allow key (a command or path), spliced in as a `<code>` element. */
    alwaysAllow: "always allow {key:string}",
    deny: "Deny",
    allowOnce: "Allow once",
  },

  planCard: {
    header: "Plan",
    commentsPending:
      "{count:number} {{comment|comments}} pending - request changes to send them, or approve to execute as-is.",
    approvingHint:
      "Approving switches the session out of plan mode and sends a continuation prompt.",
    revise: "Revise",
    reviseAria: "Send pending comments to revise the plan",
    approve: "Approve & execute",
    approveAria: "Approve and execute plan",
    /** `mode` is the picked mode's own label. */
    targetModeAria: "Approval target mode: {mode:string}",
    /**
     * The post-approval mode table. Deliberately separate from `chat.modeMenu`: it answers a
     * different question ("which mode after approving?" rather than "which mode am I in?") and
     * words two of its three entries differently.
     */
    targetMode: {
      ask: { label: "Ask permissions", blurb: "Confirm each mutating tool call." },
      acceptEdits: { label: "Accept edits", blurb: "Auto-approve edits in this project." },
      auto: { label: "Auto", blurb: "Auto-run; risky actions pause for approval." },
    },
  },

  /**
   * Count phrases. typesafe-i18n plurals are **positional** — `{{zero|one|two|few|many|other}}` —
   * and there is no named form. English only distinguishes one/other, so two slots say everything;
   * Russian needs all six, and because the library routes `0` to the `zero` slot rather than to
   * CLDR's category (which for `ru` is `many`), the Russian `zero` slot repeats its `many` text.
   *
   * `{{count:a|b}}` selects on `count` without printing it — used where the number is rendered
   * separately, as in the review banner's badge.
   */
  review: {
    /** Per-turn file count inside the review panel's turn list. */
    fileCount: "{count:number} {{file|files}}",
    /** Banner label. The count itself is rendered separately as a badge, hence `{{count:…}}`. */
    filesChanged: "{{count:file|files}} changed",
    /**
     * Rendered as a JSX sibling of `filesChanged`, not interpolated into it: typesafe-i18n **trims
     * interpolated argument values**, so a leading separator passed as `{turns}` would arrive as
     * "· 3 turns" and collide with the preceding word. Whitespace inside a *template* survives,
     * which is why the leading space here is safe.
     */
    turnSuffix: " · {count:number} {{turn|turns}}",

    /** `features/review/` renders inside the chat column, so its chrome keys under `chat`. */
    cta: "Review changes →",
    title: "Review changes",
    rejectAll: "Reject all",
    acceptAll: "Accept all",
    close: "Close review",
    selectFile: "select a file",
    loadingDiff: "Loading diff…",
    fileList: "Files in this turn",
    rejectFile: "Reject {path:string}",
    acceptFile: "Accept {path:string}",
  },

  /** `MessageSurface.tsx`'s author tag on a user bubble. */
  authorYou: "you",

  /** `ModelBadge.tsx` — the empty state before a model has been chosen. */
  selectModel: "select model",

  tools: {
    moreLines: "⋯ {count:number} more {{line|lines}}",
    editCount: "{count:number} {{edit|edits}}",

    /**
     * The collapsed-output affordance in `tools/renderers/common.tsx`. `showFullOutput` and
     * `linesTotal` are two different strings - the first is the button label, the second its
     * tooltip - and conflating them still passes the tests while shipping a wrong tooltip.
     * Both counts are structurally > `CODE_BLOCK_COLLAPSED_LINES`, but the plural forms are here
     * so Russian can decline them.
     */
    showLess: "Show less",
    showFullOutput: "Show full output ({count:number} {{line|lines}})",
    linesTotal: "{count:number} {{line|lines}} total",
    /** `EDIT_RENDERER_COLLAPSED_EDITS` is 3, so this count is always at least 4. */
    showAllEdits: "Show all {count:number} {{edit|edits}}",

    /**
     * The header's status column and the expanded body's error heading. `ok` / `error` are the
     * words the user reads, not the `ToolCallStatus` values - those stay identifiers.
     */
    stat: {
      ok: "ok",
      error: "error",
    },
    errorHeading: "Error",

    /**
     * The `StatusIcon` accessible names. `name` is the tool's own name from pi and is never
     * translated; `fallbackName` stands in when a call carries none.
     */
    status: {
      fallbackName: "Tool",
      queued: "{name:string} is queued",
      running: "{name:string} is running",
      completed: "{name:string} completed",
      failed: "{name:string} failed",
      failedWith: "{name:string} failed: {error:string}",
      cancelled: "{name:string} cancelled",
    },

    /**
     * Section headings shared by `DefaultRenderer` and `McpRenderer`, and the per-renderer chrome.
     * Everything interpolated into these - paths, patterns, globs, offsets - is model-supplied.
     */
    section: {
      input: "Input",
      result: "Result",
      partialResult: "Partial result",
      tool: "Tool",
      /**
       * Named `args`, not `arguments`: typesafe-i18n builds each catalog node as a function and
       * `arguments` is a reserved own-property on one, so that spelling throws at lookup time.
       */
      args: "Arguments",
    },
    read: {
      offset: "offset {offset:number}",
      limit: "limit {limit:number}",
      contents: "File contents",
    },
    write: {
      contents: "File contents to write",
    },
    bash: {
      output: "Bash output",
    },
    grep: {
      in: "in {path:string}",
      glob: "glob {glob:string}",
      caseInsensitive: "case-insensitive",
      literal: "literal",
      matches: "Grep matches",
    },
    find: {
      in: "in {path:string}",
      results: "Find results",
    },
    ls: {
      listing: "Directory listing",
    },
  },

  header: {
    sessionTitle: "Session title",
  },

  /**
   * The composer's mode picker. Deliberately keeps its own copy of the agent-mode vocabulary
   * rather than sharing `settings.agents.mode`: the surfaces word some entries differently
   * (the plan card says "Ask permissions" where this says "Ask"), and one shared key would have
   * to pick a single wording for all of them. Worth revisiting once the Russian catalog lands.
   */
  modeMenu: {
    ariaLabel: "Agent mode",
    header: "Agent mode",
    /** Keyed by `ExecutionMode`; the keys are protocol values. */
    ask: { label: "Ask", blurb: "Confirm before each write or shell command." },
    acceptEdits: { label: "Accept edits", blurb: "Auto-accept edits to listed files & paths." },
    auto: { label: "Auto", blurb: "Auto-run; risky actions pause for approval." },
    /** The hyphen here is deliberate ASCII, not an em dash. */
    plan: { label: "Plan", blurb: "Plan-only - no writes, no commands." },
  },

  /** The composer's effort chip. Three levels; `ThinkingLevelPicker` exposes all six. */
  effortPicker: {
    header: "Effort",
    ariaLabel: "Select thinking effort",
    adaptive: "Adaptive",
    adaptiveTooltip: "Adaptive thinking — managed by the model",
    /** The chip shown beside an adaptive model's name in the picker. */
    adaptiveChip: "adaptive",
    level: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
  },

  /** The six-level thinking picker. `level` is interpolated raw — it is the protocol value. */
  thinkingPicker: {
    chip: "thinking · {level:string}",
    ariaLabel: "Thinking: {level:string}",
    level: {
      off: "Off",
      minimal: "Minimal",
      low: "Low",
      medium: "Medium",
      high: "High",
      xhigh: "X-High",
    },
  },

  /** Model names, ids and provider names are registry data — only the chrome is ours. */
  modelMenu: {
    triggerAria: "Model: {label:string}",
    selectModel: "Select model",
    /** Appended to the trigger when a thinking level is set; `level` is the protocol value. */
    thinkingSuffix: " · {level:string}",
    thinkingTag: "thinking",
    loadingModels: "Loading models…",
    needsKey: "Provider needs an API key.",
    noModel: "No model selected — open the picker.",
    openPicker: "Open model picker…",
  },

  modelPicker: {
    ariaLabel: "Select model",
    searchPlaceholder: "Search models…",
    empty: "No models match",
    /** Marks the provider group that is the session default. */
    default: "default",
    /** Stands in for a model label when neither a label nor an id is available. */
    fallbackLabel: "model",
  },

  contextUsage: {
    buttonAria: "Context usage: {percent:number}%",
    title: "Context usage",
    /** Both figures are already formatted by `formatTokens`. */
    ofTokens: "{used:string} of {total:string} tokens used.",
    messages: "Messages",
    systemPrompt: "System prompt",
    projectContext: "Project context",
    /** `AGENTS.md` / `CLAUDE.md` are filenames and stay verbatim. */
    projectContextTitle:
      "Project context files (AGENTS.md, CLAUDE.md, etc.) pi injects into the system prompt",
    tools: "Skills / tool definitions",
    mcp: "MCP tools",
    free: "Free space remaining",
  },

  /** Only the menu's own chrome. Command names, descriptions and paths come from pi. */
  slashMenu: {
    ariaLabel: "Slash commands",
    /**
     * Keyed by `SessionCommandInfo["source"]` — the keys are protocol values, the values are
     * ours. Note `prompt` reads "template", so this is not a "same word, skip it" table.
     */
    source: {
      skill: "skill",
      prompt: "template",
      extension: "extension",
    },
  },

  imagePreview: {
    close: "Close preview",
    /** Fallbacks for an attachment that carries no filename. */
    untitled: "Image",
    altFallback: "Attached image",
    /** The name given to an image pasted from the clipboard. */
    pastedName: "Pasted image",
    /** Rendered by the OS file dialog. */
    fileFilter: "Images",
  },

  messageList: {
    jumpToLatest: "Jump to latest",
    jumpToLatestAria: "Jump to latest message",
  },

  streaming: {
    /** Three ASCII dots, not an ellipsis - it is the agent "typing" tell. */
    thinking: "Thinking...",
  },

  /** The hover row under a bubble, plus its rewind confirmation. */
  messageActions: {
    copy: "Copy message",
    rewind: "Rewind to here",
    fork: "Fork from here",
    streamingHint: "Unavailable while streaming",
    noAnchor: "No earlier point to branch from",
    confirmTitle: "Rewind to here?",
    confirmDescription:
      "The conversation and any file changes made after this message will be discarded. Later uncommitted edits can't be recovered.",
    confirmLabel: "Rewind",
  },

  contextMenu: {
    copyText: "Copy text",
    copyMarkdown: "Copy as Markdown",
    commentSelection: "Comment the selection",
    attachSelection: "Attach selection to next prompt",
  },

  /** Accessible names for the plan checkbox glyphs in `markdown/CheckboxItem.tsx`. */
  checkbox: {
    completed: "Completed",
    inProgress: "In progress",
    notStarted: "Not started",
  },

  planComments: {
    count: "{count:number} {{comment|comments}}",
    /** `Enter` / `Esc` are key names and survive translation verbatim. */
    placeholder: "Add a comment…  Enter to add · Esc to cancel",
    ariaLabel: "Comment on the selected plan text",
    edit: "Edit comment",
    delete: "Delete comment",
    submit: "Comment",
    save: "Save",
  },

  errors: {
    copy: "Failed to copy",
    /** Two whole keys, not one with an interpolated verb — the clause order is not portable. */
    approveTool: "Failed to approve tool",
    denyTool: "Failed to deny tool",
    approvePlan: "Failed to approve plan",
    sendAnswer: "Failed to send your answer",
    filePickerUnavailable: "File picker unavailable in this build",
    folderPickerUnavailable: "Folder picker unavailable in this build",
    changeAgentMode: "Failed to change agent mode",
    imagePickerUnavailable: "Image picker unavailable in this build",
    /** `type` is the browser-reported MIME type, or `unknownType` when it reported none. */
    unsupportedImageType: "Unsupported image type: {type:string}",
    unknownType: "unknown",
    /** `mb` is the configured cap, already rounded. */
    imageTooLarge: "Image too large — max {mb:string} MB",
    /** `message` is the underlying failure, already humanized. */
    attachImage: "Couldn't attach image: {message:string}",
    readImage: "Failed to read image",
    openFileDialog: "Failed to open file dialog",
    decodeImage: "Failed to decode image",
    fileReader: "FileReader failed",
  },

  planSnapshot: {
    chip: "Plan",
    /** Both numbers are step counts, rendered as one line. */
    summary: "{done:number} of {total:number} done",
    earlierSteps: "+{count:number} earlier {{step|steps}}",
    moreSteps: "+{count:number} more {{step|steps}}",
  },

  /**
   * The `ask_user_question` card. Question text, headers, option labels and descriptions all come
   * from the model and are never translated — everything here is the card's own chrome.
   *
   * The hint rows interleave `<PidKbd>` glyphs with prose and go through `i18n/rich.tsx`, so each
   * one is a single catalog sentence a translator can reorder.
   */
  ask: {
    sendChoices: "Send {count:number} {{choice|choices}}",
    yourAnswer: "your answer",
    backToOptions: "back to options",
    addMissing: "Add one I missed…",
    addMissingHint: "Include something the list didn't cover.",
    previewBadge: "preview",
    noPreview: "No preview for this option.",

    eyebrow: "pi is asking",
    eyebrowResolved: "pi asked",
    /** Status line in the card header, one per layout. */
    awaitingPick: "awaiting your pick",
    pickAny: "pick any",
    answeredCount: "{answered:number}/{total:number} answered",
    answeredStatus: "answered",
    noAnswer: "No answer recorded.",

    /** The free-text escape hatch. The hyphen in the blurb is deliberate ASCII. */
    somethingElse: "Something else…",
    somethingElseDesc: "None of these fit - write a custom answer.",
    describePlaceholder: "Describe what you want…",
    /** `enter` / `shiftEnter` arrive as `<PidKbd>` elements. */
    composerHint: "{enter:string} send · {shiftEnter:string} new line",

    /** `from` / `to` are the first and last option numbers, rendered as `<kbd>` elements. */
    pickHint: "{from:string}–{to:string} pick · {enter:string} send",
    toggleHint: "{from:string}–{to:string} toggle",
    previewHint: "{up:string}{down:string} preview · {enter:string} choose",
    /** Same shape as `pickHint`, for the branch whose Enter advances rather than sends. */
    pickNextHint: "{from:string}–{to:string} pick · {enter:string} next",

    sendPick: "Send pick",
    sendCustom: "Send custom answer",
    /** The quotes are U+201C/U+201D; `label` is the model's own option label. */
    choose: "Choose “{label:string}”",
    sendAnswers: "Send answers",
    skip: "Skip",
    review: "Review",
    reviewHint: "review your answers, then send",

    addedByYou: "added by you",
    addItem: "add an item",
    addPlaceholder: "Type a value…",
    add: "Add",
    remove: "Remove",

    /** Summary words in the review list. */
    notAnswered: "not answered",
    skipped: "skipped",
    /** How several picked options are joined in the review list. */
    joinSeparator: ", ",
  },
} as const;

export default chat;
