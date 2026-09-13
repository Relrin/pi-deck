/**
 * Strings for `features/settings/`.
 *
 * Note the naming overlap: `settings.editor` / `settings.terminal` / `settings.git` are the
 * *settings panes for* those features, while the `editor` / `terminal` / `git` namespaces belong to
 * the features themselves. Different first segment, no collision — but it reads oddly the first time.
 *
 * Each section carries three separate strings rather than one reused word, because they diverge:
 * `nav.*` is the label in the left list, `<section>.kicker` is the word after "Settings ·", and
 * `<section>.title` is the `<h1>`. Providers reads *Agents & Models* / *Agents* / *Agents & Models*;
 * Skills reads *Skills* / *Skills* / *Agent Skills*.
 */
const settings = {
  /** The dialog's accessible name and its header title — the same word in the same context. */
  title: "Settings",
  close: "Close settings",
  /** The back affordance's tooltip. `Esc` here is a key name, not copy. */
  back: "Back (Esc)",
  /** Spliced with `<PidKbd>` through `i18n/rich.tsx` — see the slot convention there. */
  escHint: "{esc:string} to close",
  navLabel: "Settings sections",

  /**
   * The kicker frame, interpolated with each section's own word. One template rather than eleven
   * flat "Settings · X" strings, so the separator and the word "Settings" are translated once and
   * cannot drift apart. `·` is U+00B7 and lives in the template — typesafe-i18n trims argument
   * values, so a separator passed as an argument would arrive mangled.
   */
  kicker: "Settings · {section:string}",

  nav: {
    appearance: "Appearance",
    agentModels: "Agents & Models",
    tools: "Tools",
    skills: "Skills",
    mcpServers: "MCP Servers",
    editor: "Editor",
    gitGithub: "Git & GitHub",
    terminal: "Terminal",
  },

  appearance: {
    kicker: "Appearance",
    title: "Appearance",

    theme: {
      label: "Theme",
      desc: "Pick a bundled theme or drop a VS Code theme JSON into your themes folder.",
      /** `name` is the theme's own name, from disk or from the bundle - never translated. */
      apply: "Apply theme {name:string}",
      delete: "Delete theme {name:string}",
      deleted: "Deleted theme {name:string}",
      /** Source chips on each card: shipped with the app, or added by the user. */
      chipUser: "User",
      chipDefault: "Default",
      import: "Import VS Code theme…",
      importing: "Importing…",
      imported: "Imported {name:string}",
      /** Rendered by the OS file dialog, not by us - but still read by a human. */
      fileFilter: "JSON theme",
    },

    view: {
      label: "View",
      desc: "Agent keeps the linear session - editor - diff flow. IDE docks the chat beside the editor as a right-pane tab.",
      ariaLabel: "View mode",
      agent: "Agent",
      ide: "IDE",
    },

    density: {
      label: "Density",
      desc: "Affects row heights, topbar/footer height, and base type size.",
      ariaLabel: "Density",
      compact: "Compact",
      cozy: "Cozy",
    },

    fonts: {
      label: "Fonts",
      desc: "Swap the display/UI/mono triad for a single-family aesthetic.",
      ariaLabel: "Fonts",
      default: "Default (serif + sans + mono)",
      sansOnly: "Sans only",
      monoOnly: "Mono only",
    },

    terminalWidth: {
      label: "Terminal width",
      desc: "How much horizontal space the integrated terminal takes when open — keep it in the center, or let it span over the left rail, right pane, or both.",
      ariaLabel: "Terminal width",
      centerLeft: "Center + Left",
      center: "Center",
      centerRight: "Center + Right",
      all: "All",
    },

    language: {
      label: "Language",
      desc: "Interface language.",
      hint: "Agent replies follow this too, unless you pin a language under Agents & Models.",
    },
  },
  agents: {
    kicker: "Agents",
    title: "Agents & Models",

    effort: {
      label: "Default effort",
      desc: "How deeply agent thinks. Higher effort means more thorought responses at cost of longer processing time and consuming more tokens. Applies to new conversations.",
      ariaLabel: "Default thinking effort",
      /**
       * Only the three levels the composer pickers expose. Deliberately *not* shared with
       * `chat.effortPicker` / `chat.thinkingPicker`: the surfaces word their levels independently
       * today, and a shared key would have to pick one wording for all of them.
       */
      level: {
        low: "Low",
        medium: "Medium",
        high: "High",
      },
    },

    mode: {
      label: "Default agent mode",
      desc: "How the agent handles writes & shell commands in new conversations.",
      ariaLabel: "Default agent mode",
      /** Keyed by `AgentMode`; the keys are protocol values and never translate. */
      ask: {
        label: "Ask",
        description: "Confirm before each write or shell command.",
      },
      acceptEdits: {
        label: "Accept edits",
        description: "Auto-accept edits to listed files & paths.",
      },
      auto: {
        label: "Auto",
        description: "Auto-run; risky actions pause for approval.",
      },
      plan: {
        label: "Plan",
        description: "Plan-only - no writes, no commands.",
      },
    },

    builtIn: {
      label: "Built-in providers",
      /** `path` is spliced in as a `<code>` element - it is a file path, not copy. */
      desc: "Add an API key to enable a provider's models. Keys are stored in pi's {path:string} (0600 perms) and never sent to the renderer.",
      add: "Add provider",
      empty: "No providers configured yet. Use “Add provider” to enable one with an API key.",
    },

    custom: {
      label: "Custom providers",
      desc: "OpenAI-compatible endpoints (LM Studio, Ollama, vLLM, self-hosted gateways). pi-deck writes these to {path:string}.",
      add: "Add custom",
      empty: "No custom providers yet.",
    },

    /** Per-provider row chrome. The provider's name, env var and base URL are registry data. */
    row: {
      authenticated: "Authenticated",
      needsKey: "Needs key",
      replaceKey: "Replace key",
      addKey: "Add key",
      clear: "Clear",
      setKey: "Set key",
    },

    responseLanguage: {
      label: "Agent response language",
      desc: "The language the agent writes in — its replies, its plans, and the plan file. Starter prompts are sent as written, so a template in another language stays in that language.",
      matchUi: "Match interface",
    },
  },

  tools: {
    kicker: "Tools",
    title: "Tools",
    planMode: {
      label: "Plan mode",
      desc: "What plan mode does when the agent reaches for something that isn't a read-only inspection - an edit, an MCP or network call, or a workspace-changing shell command. Read-only commands (ls, cat, grep, find, git log, etc) always run. Applies to new conversations.",
      ariaLabel: "Plan mode policy",
      /** Keyed by `PlanGatePolicy`; the key is the protocol value, only the text is copy. */
      approve: {
        label: "Ask for approval",
        description: "Prompt to allow or deny each non-read-only operation while planning.",
      },
      block: {
        label: "Always block",
        description: "Refuse every non-read-only operation while planning (strict plan-only).",
      },
    },
    disabled: {
      label: "Disabled tools",
      desc: "Disable tools you don't want the agent to use. This applies to new sessions; existing sessions keep their own setting.",
    },
  },

  editor: {
    kicker: "Editor",
    title: "Editor",
    lsp: {
      label: "Language servers",
      /**
       * Two complete sentences rather than a shared tail glued onto a `{env}` argument: the
       * composition byte-preserves English but freezes its clause order, and the trailing clause
       * may well want to lead in another language.
       */
      descWsl:
        "This project lives in WSL — servers are detected and run inside the {distro:string} distro. Nothing is bundled — missing servers just fall back to basic completion.",
      descLocal:
        "Servers are detected on this machine's PATH and start automatically when you open a matching file. Nothing is bundled — missing servers just fall back to basic completion.",
      descNoProject: "Open a project to see which language servers are available for it.",
      /**
       * The badge beside each server. The *values* here are copy; the `data-state` attribute the
       * badge also carries stays the raw identifier, because the stylesheet keys off it.
       */
      state: {
        running: "running",
        detected: "detected",
        notFound: "not found",
        custom: "custom",
      },
      /** `hint` is the server's own install command - never translated. */
      install: "install: {hint:string}",
      edit: "Edit",
      on: "On",
      off: "Off",
      /** `label` is the language server's own display name. */
      enableServer: "Enable {label:string} language server",
      toggleDesc: "Off stops the server and falls back to basic completion.",
      detecting: "Detecting...",
      redetect: "Re-detect servers",
      addServer: "Add server",
    },
  },

  terminal: {
    kicker: "Terminal",
    title: "Terminal",
    shell: {
      label: "Shell",
      desc: "Shells detected on this system. Choosing one applies to terminals opened afterward.",
      ariaLabel: "Shell",
      systemDefault: "System default",
      /** `name` is the detected shell's own label or path. */
      systemDefaultNamed: "System default ({name:string})",
      /** Both halves are data; only the separator is ours. */
      option: "{label:string} — {path:string}",
    },
    cwd: {
      label: "Working directory",
      desc: "New terminals open in the active session's root folder, inheriting its git branch.",
      ariaLabel: "Default working directory",
      session: "Session root",
      lastUsed: "Last used",
    },
    font: {
      label: "Font",
      /** `custom` and `mono` are spliced in as `<code>` elements - see `i18n/rich.tsx`. */
      desc: "Pick an installed monospace family, or choose {custom:string} to type your own. The default follows the UI mono font ({mono:string}).",
      /** The CSS custom property name is an identifier and must survive translation verbatim. */
      monoVar: "--font-mono",
      defaultOption: "Default (--font-mono)",
      custom: "Custom…",
      familyAriaLabel: "Font family",
      customAriaLabel: "Custom font family",
      customPlaceholder: "e.g. Fira Code, monospace",
      /**
       * Qualifies `PidStepper`'s own `shell.components.stepper.increase` template, which composes
       * "Increase font size". Keep it lowercase and keep the wording - `TerminalSection.test.tsx`
       * asserts the composed result.
       */
      sizeLabel: "font size",
    },
  },

  /**
   * Last-resort text for a failed action, reached only when the host sent no recognisable error
   * code and no message of its own - see `git.errors.*` for the same shape. One key per call site
   * on purpose: "failed to update the server" and "failed to update the config" are different
   * failures and a shared key would flatten them.
   */
  errors: {
    filePickerUnavailable: "File picker is unavailable in this build",
    folderPickerUnavailable: "Folder picker unavailable in this build",
    installSkill: "Failed to install skill",
    removeSkill: "Failed to remove skill",
    scanRepository: "Failed to scan repository",
    installSkills: "Failed to install skills",
    updateServer: "Failed to update server",
    updateConfig: "Failed to update config",
    saveToken: "Failed to save token",
    reconnect: "Failed to reconnect",
    removeServer: "Failed to remove server",
    registrySearch: "Registry search failed",
    installServer: "Failed to install server",
    importTheme: "Failed to import theme",
    deleteTheme: "Failed to delete theme",
  },

  git: {
    kicker: "Git & GitHub",
    title: "Git & GitHub",

    lineStyle: {
      label: "Diff line style",
      desc: "How added and removed lines are marked in the diff viewer.",
      ariaLabel: "Diff line style",
      /** Keyed by `DiffIndicators`; keys are persisted preference values. */
      bars: {
        label: "Bars",
        description: "Thin coloured bar at the row's leading edge, no full-width background.",
      },
      classic: {
        label: "Classic",
        description: "+ / − markers in the gutter with full-width add/del background.",
      },
      none: {
        label: "None",
        description: "No markers, no background. Cleanest read for prose-heavy diffs.",
      },
    },

    layout: {
      label: "Diff layout",
      desc: "Default arrangement when a diff opens. Per-view, the diff toolbar can flip between the two — the value here is the starting point that change persists into.",
      ariaLabel: "Diff layout",
      split: {
        label: "Side-by-side",
        description: "Old and new content in adjacent columns.",
      },
      unified: {
        label: "Unified",
        description: "Stacked old + new in one column, like `git diff` output.",
      },
    },

    lineDiff: {
      label: "Inline change highlight",
      desc: "How fine-grained the within-line highlight is. The per-diff toolbar's dropdown shows the same options and writes back here.",
      ariaLabel: "Inline change highlight algorithm",
      wordAlt: {
        label: "Word-Alt",
        description: "Whole-word highlights, enhanced algorithm.",
      },
      word: {
        label: "Word",
        description: "Changed words within lines.",
      },
      char: {
        label: "Character",
        description: "Individual character changes.",
      },
      none: {
        label: "None",
        description: "Line-level changes only.",
      },
    },

    display: {
      label: "Diff display",
      desc: "Independent on/off toggles applied to every diff view in the app.",
      backgrounds: {
        label: "Backgrounds",
        description: "Full-width add/del row background.",
      },
      lineNumbers: {
        label: "Line Numbers",
        description: "Show the line-number gutter.",
      },
      wrapping: {
        label: "Wrapping",
        description: "Wrap long lines instead of horizontal scrolling.",
      },
    },

    themes: {
      label: "Diff themes",
      desc: "Separate Pierre/Shiki themes for light and dark app modes. The one matching the active theme's kind is applied to every diff view.",
      /**
       * The card's own heading. `kind` doubles as the `data-kind` attribute the stylesheet keys
       * off, so the identifier stays raw and only this label is copy.
       */
      light: "light",
      dark: "dark",
      /** Two whole labels rather than a mode word glued to a suffix. */
      lightPicker: "Light-mode diff theme",
      darkPicker: "Dark-mode diff theme",
    },
  },

  mcp: {
    kicker: "MCP Servers",
    title: "MCP Servers",
    /** `enabled` is spliced in as its own accent-coloured element. */
    countOn: "{enabled:string} of {total:number} on",
    countOnInProject: "{enabled:string} of {total:number} on in {project:string}",
    /** `adapter`, `proxy` and `config` arrive as `<code>` elements - all three are identifiers. */
    about:
      "Connect MCP servers through {adapter:string} — one token-efficient {proxy:string} proxy tool instead of hundreds of definitions. Servers are added to your catalog, then toggled on per project (written to {config:string}).",

    adapter: {
      installed: "Adapter installed",
      notDetected: "Adapter not detected",
      /** `cmd` is the install command, spliced in as a `<code>` element. */
      installWith: "· install with {cmd:string}",
    },

    /** `path` is spliced in as its own element. */
    writesTo: "writes {path:string}",
    revealTitle: "Reveal in file manager",
    revealAria: "Reveal config location in file manager",
    filterPlaceholder: "Filter servers…",
    installServer: "Install server",
    noProject: "Open a project to configure its MCP servers.",

    list: {
      installed: "Installed",
      catalogHint: "· your catalog",
      /** The trailing arrow points at the per-row switch. */
      onIn: "on in {project:string} →",
      /** Used when no project is open, in place of the project's name. */
      projectFallback: "project",
    },
    loading: "Loading…",
    /** The quotes are U+201C/U+201D; `query` is what the user typed. */
    noMatch: "No servers match “{query:string}”.",
    empty: "No servers installed yet — install one from the registry.",
    /** `path` is spliced in as a `<code>` element. */
    toggleHint: "Toggling a server writes / removes it in this project's {path:string}.",

    projectPicker: {
      select: "Select project",
      header: "set defaults for",
    },

    /**
     * The chips beside a server name. `lifecycle`, `auth` and the `direct` expose value are raw
     * config values and stay untranslated; only this one is a phrase of ours.
     */
    chip: {
      projectFile: "project file",
    },
    status: {
      cached: "cached",
      notConnected: "not connected yet",
      /** `count` is the adapter's tool count. */
      toolCount: "{count:number} {{tool|tools}} · ",
    },
    configure: "configure",
    onByDefault: "on by default",
    off: "off",

    config: {
      lifecycle: "Lifecycle",
      /** Keyed by the `Lifecycle` protocol value. */
      lazy: { label: "Lazy", hint: "connect on first call" },
      eager: { label: "Eager", hint: "connect at startup" },
      keepAlive: { label: "Keep-alive", hint: "always on, auto-reconnect" },

      exposure: "Tool exposure",
      proxy: "Proxy",
      direct: "Direct",
      /**
       * The row chip spells the same choice in lower case. A separate key rather than
       * `.toLowerCase()` on the one above: in a language with cases the inline form is a
       * different word, not a different capitalisation.
       */
      directChip: "direct",
      /** `count` is the adapter's tool count, `tokens` the already-localized token figure. */
      exposeDirectCount: "{count:number} {{tool|tools}} registered directly",
      exposeDirectCountTokens:
        "{count:number} {{tool|tools}} registered directly (~{tokens:string} tokens)",
      exposeDirect: "Tools registered directly as first-class tools",
      exposeProxy: "Routed through the mcp proxy (~200 tokens, shared)",

      idle: "Idle timeout",
      idleHint: "Disconnect after inactivity to free resources.",
      /** Duration abbreviations on the idle-timeout control. */
      idle5: "5m",
      idle10: "10m",
      idle30: "30m",
      idleNever: "Never",
    },

    token: {
      placeholder: "Paste bearer token",
      save: "Save",
      clear: "Clear",
      hint: "Stored encrypted in your OS keychain — never written to mcp.json.",
      saved: "Token saved",
      cleared: "Token cleared",
      savedBody:
        "Stored encrypted. Applies to new agent sessions — restart a running one to pick it up.",
      edit: "Edit token",
      set: "Set token",
    },

    oauth: {
      rerun: "Re-run OAuth",
      title: "OAuth runs in the agent",
      /** `name` is the user's own server name. */
      body: "Start or resume a pi session — {name:string} will prompt you to authorize.",
    },

    reconnect: "Reconnect",
    reconnectQueued: "Reconnect queued",
    reconnectBody: "Cleared cached tools for {name:string} — the agent reconnects on next use.",
    confirmUninstall: "Confirm uninstall",
    uninstall: "Uninstall globally",
    /** `name` is the user's own server name. */
    disableServer: "Disable {name:string}",
    enableServer: "Enable {name:string}",

    /** The install-from-registry modal. */
    install: {
      /** The registry hostname is an address, not copy. */
      kicker: "mcp registry · registry.modelcontextprotocol.io",
      title: "Install MCP server",
      desc: "Search the official registry and install a server into your catalog — it's enabled for the current project right away.",
      searchPlaceholder: "Search the registry — name, capability, publisher…",
      searching: "Searching the registry…",
      unreachable: "Couldn't reach the registry. Check your connection and try again.",
      /** `query` arrives as its own monospace element, quotes included. */
      noMatch: "No servers match {query:string}.",
      shownCount: "{count:number} shown",
      loadMore: "Load more",
      loading: "Loading…",
      /** `path` is spliced in as its own accent-coloured element. */
      installsTo: "installs to {path:string}",
      configFallback: ".pi/mcp.json",
      added: "Added",
      installed: "Installed",
      installing: "Installing…",
      install: "Install",
      installedTitle: "Installed {name:string}",
      installedBody: "Enabled in {project:string} · added to your MCP catalog",
      /** Used in the toast when no project name is available. */
      projectFallback: "this project",
      /** Notification tag, same register as `git.notify.*.tag`. */
      tag: "MCP",
    },
  },

  /**
   * The two install modals' dismiss badge. Distinct from `escHint` above, which is a sentence
   * with the key spliced in; this is the key cap on its own.
   */
  escBadge: "esc",

  skills: {
    kicker: "Skills",
    title: "Agent Skills",
    /** `count` is spliced in as its own accent-coloured element. */
    installedCount: "{count:string} installed",

    /** `link`, `cmd` and `warning` arrive as elements through `i18n/rich.tsx`. */
    about:
      "Skills are capability packages the agent loads on demand ({link:string}). Their descriptions ride along in the system prompt, and each one is invocable directly by typing {cmd:string} in the composer. {warning:string} — a skill can instruct the agent to run arbitrary code.",
    aboutLink: "Agent Skills standard",
    aboutWarning: "Review skill content before installing",

    filterPlaceholder: "Filter skills…",
    installFromRepo: "Install from repo",
    installing: "Installing…",
    fromFolder: "From folder…",
    noProject: "Open a project to list its skills.",
    scanning: "Scanning…",
    /** The quotes are U+201C/U+201D; `query` is what the user typed. */
    noMatch: "No skills match “{query:string}”.",
    empty: "No skills installed yet — install from a repo or a local folder.",
    group: {
      installed: "Installed",
      installedHint: "global",
      project: "Project",
      projectHint: "this repo",
    },
    manualOnly: "manual only",
    confirmRemove: "Confirm remove",
    installedToast: "Installed {name:string}",
    installedUnnamedToast: "Installed skill",

    /** The install-from-git modal. */
    install: {
      kicker: "skills · install from git",
      title: "Install from repository",
      desc: "Clone a repository, review the skills it contains, and install the ones you pick.",
      /** The sample URLs are examples, not copy - keep them recognisable. */
      urlPlaceholder: "github.com/owner/repo  ·  or  git@github.com:owner/repo.git",
      scan: "Scan",
      try: "try:",
      invalidUrl: "Enter a valid git repository URL (owner/repo).",
      cloning: "Cloning repository…",
      scanningTree: "Scanning tree for SKILL.md manifests…",
      selectAll: "Select all",
      selectNone: "Select none",
      noManifests: "No SKILL.md manifests found in this repository.",
      /** `file` is spliced in as a `<code>` element. */
      pointAt: "Point pi at any repository that contains {file:string} manifests.",
      pointAtDetail:
        "It clones shallowly, lists the skills it finds, and installs just the ones you want.",
      /** `picked` is spliced in as its own accent-coloured element. */
      selectedCount: "{picked:string} of {total:number} selected",
      noRepoScanned: "No repository scanned yet",
      installSelected: "Install selected",
      installNSelected: "Install {count:number} selected",
      nothingInstalled: "Nothing installed",
      nothingInstalledBody: "Every selected skill was already installed.",
      /** Appended to the toast's meta line - the separator lives in the template. */
      skippedNote: " · {count:number} already installed",
      alreadyInstalled: "· already installed",
      /** Notification tag, same register as `git.notify.*.tag`. */
      tag: "SKILLS",
    },

    scanFoundToast: "found {count:number} SKILL.md {{manifest|manifests}}",
    installedTitle: "Installed {count:number} {{skill|skills}}",
    scanFoundLabel: "{count:number} {{skill|skills}} found",
  },
} as const;

export default settings;
