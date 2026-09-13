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

  /** Per-session agent-language override, shown in the composer beside the mode and effort chips. */
  languagePicker: {
    label: "Agent language",
    matchGlobal: "Use default",
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
  },

  tools: {
    moreLines: "⋯ {count:number} more {{line|lines}}",
    editCount: "{count:number} {{edit|edits}}",
  },

  planSnapshot: {
    earlierSteps: "+{count:number} earlier {{step|steps}}",
    moreSteps: "+{count:number} more {{step|steps}}",
  },

  planCard: {
    commentsPending:
      "{count:number} {{comment|comments}} pending - request changes to send them, or approve to execute as-is.",
  },

  planComments: {
    count: "{count:number} {{comment|comments}}",
  },

  ask: {
    sendChoices: "Send {count:number} {{choice|choices}}",
  },
} as const;

export default chat;
