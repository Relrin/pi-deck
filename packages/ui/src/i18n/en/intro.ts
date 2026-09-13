/**
 * Strings for `features/intro/`.
 *
 * The starter templates are both a card the user reads *and* the prompt sent verbatim when they
 * pick one, so `body` is translated along with `title` and `blurb`. One consequence worth knowing:
 * a Russian template body is sent as written, so a user with the agent pinned to English gets a
 * Russian prompt. Models handle that fine, and the settings hint says so.
 *
 * `id` and `num` deliberately stay in `features/intro/templates.ts` — they key the user's
 * persisted overrides under `pi-deck:templates:v1`, and moving or renaming them would orphan
 * every edit a user has made.
 */
const intro = {
  templates: {
    "fix-failing-test": {
      title: "Fix a failing test",
      blurb: "Paste a stack trace, get a patched test + fix.",
      body: "Here's a failing test:\n\n```\n<paste the test name + full stack trace / assertion output>\n```\n\nReproduce it first, then find the root cause — explain in a sentence or two what's actually broken before you change any code. Apply the smallest fix that makes it pass without weakening the test; if the test's expectation was wrong, fix the test instead and tell me why. Re-run the affected tests to confirm they're green and that nothing nearby broke.",
    },
    "implement-a-spec": {
      title: "Implement a spec",
      blurb: "Drop a Markdown spec, pi plans + writes against it.",
      body: "Implement the spec below.\n\n```markdown\n<paste the spec here>\n```\n\nFirst read the relevant code and outline a short plan: the files you'll touch, the order you'll do them in, and any ambiguities you need me to resolve. Wait for my go-ahead, then build it in small, reviewable steps that follow the existing patterns and conventions. Add or update tests for the new behaviour and run them, and flag anything in the spec that was unclear or that you had to deviate from.",
    },
    "refactor-in-place": {
      title: "Refactor in place",
      blurb: "Pick a file, describe the shape you want.",
      body: "Refactor <path/to/file> into <describe the shape you want>.\n\nKeep this behaviour-preserving: the public API and observable behaviour stay identical unless I say otherwise. Work in small steps and keep the build and existing tests green after each one — don't rewrite everything at once. Avoid unrelated drive-by changes, and when you're done, summarise what moved and why.",
    },
    "write-the-docs": {
      title: "Write the docs",
      blurb: "Generate docs from a module + commit.",
      body: "Write developer-facing documentation for <module / path>.\n\nRead the actual code first so the docs match reality - don't invent behaviour. Cover what it's for, the public API (signatures and key parameters), at least one runnable usage example, and the common gotchas or edge cases. Match the project's existing docs style and location. Show me the draft, then commit it with a clear message once it reads well.",
    },
    "review-a-pr": {
      title: "Review a PR",
      blurb: "Open a PR by number, get a structured review.",
      body: "Review PR #<number> (or this branch's diff against <base branch>).\n\nWork from the actual diff and give a structured review:\n- Correctness - bugs, edge cases, error handling.\n- Design - does it fit the codebase; is there a simpler approach?\n- Tests - is the new behaviour covered; what's missing?\n- Risk - security, performance, migrations, backward compatibility.\n\nCite specific files and lines, separate must-fix blockers from nits, and finish with a clear verdict (approve / request changes). Don't change any code unless I ask.",
    },
    "bisect-a-regression": {
      title: "Bisect a regression",
      blurb: "Find the commit that broke a behaviour.",
      body: "Help me track down a regression.\n\n- Expected: <what used to happen>\n- Broken: <what happens now>\n- Last known-good: <commit / tag / version, if known>\n\nReproduce the broken behaviour first, then narrow down the offending change against that reproduction (git history / git bisect). Identify the exact commit that introduced it and explain why that change caused the break, then propose the lower-risk fix — a targeted forward fix or a revert — plus the test that should have caught it.",
    },
  },
  /**
   * Intro **chrome** — everything on the two landing screens that is not a template card.
   *
   * `PidComposerScreen.tsx` and `PidIntroScreen.tsx` are two hosts for the same surface and
   * deliberately word the hero differently (sentence case versus lower case), so each keeps its
   * own key rather than sharing one. Project names, branch names, file paths and model ids that
   * appear here are data and pass through untranslated.
   */
  hero: {
    /** `PidComposerScreen`'s sentence-case heading. */
    titleComposer: "What are we shipping today?",
    /** `PidIntroScreen`'s lower-case heading. The casing is the design, not an accident. */
    titleIntro: "what are we shipping today?",
    blurb:
      "Drop a task, paste a stack trace, or @-mention a file. pi reads your repo, proposes a plan, and writes code against a fresh branch.",
  },

  composer: {
    newPrompt: "New prompt",
    placeholder: "e.g. 'add a /share button to PostHeader that copies a tracked URL'",
    send: "Send",
    sendLabel: "Send message",
    sendTooltip: "Send message · Enter",
    dispatch: "Dispatch",
    dispatchLabel: "Dispatch prompt",
    dispatchTooltip: "Dispatch · Enter",
    or: "or",
    newSession: "new session",
    /** `{name}` is the project's display name, upper-cased by the design. */
    statusIdle: "{name:string} · IDLE",
    statusIdleNoProject: "PI-DECK · IDLE",
    noProject: "no project",
    /** `{name}` is a project name, `main` a branch. Neither translates. */
    projectBranch: "{name:string} · main",
    noProjectBranch: "no project · main",
    selectWorkspace: "Select workspace",
    openFolder: "Open another folder…",
    removeAttachment: "Remove {path:string}",
    previewImage: "Preview {name:string}",
    removeImage: "Remove {name:string}",
  },

  templateCards: {
    heading: "start from a template",
    edited: "edited",
    editTitle: "Edit template",
    editLabel: "Edit template: {title:string}",
    editMenuItem: "Edit template…",
    resetMenuItem: "Reset to default",
    recent: "recent",
  },

  /** `EditTemplateDialog.tsx`. */
  editDialog: {
    title: "Edit template",
    description:
      "Override this template's title, description, and prompt. Changes are saved locally.",
    fieldTitle: "Title",
    fieldBlurb: "Short description",
    fieldPrompt: "Prompt",
    promptHint: "Inserted into the composer when the card is clicked.",
    reset: "Reset to default",
    apply: "Apply",
  },

  /** `PidAgentModePicker.tsx`. The `value`s are protocol agent modes. */
  agentMode: {
    label: "Agent mode",
    header: "Agent mode",
    ask: { label: "Ask", blurb: "Confirm before each write or shell command." },
    acceptEdits: { label: "Accept edits", blurb: "Auto-accept edits to listed files & paths." },
    auto: { label: "Auto", blurb: "Auto-run; risky actions pause for approval." },
    plan: { label: "Plan", blurb: "Plan-only - no writes, no commands." },
  },

  /** `PidEffortPicker.tsx`. */
  effort: {
    label: "Select thinking effort",
    header: "Effort",
    low: "Low",
    medium: "Medium",
    high: "High",
  },

  /** `PidAttachmentsPicker.tsx`. */
  attachments: {
    label: "Attach files or folders",
    header: "Attach",
    addFiles: "Add files",
    addImage: "Attach image",
    addImageHint: "paste · drop · pick",
    addFolder: "Add folder",
    fromRepo: "Reference from repo",
    recent: "Recent",
    current: "Currently attached",
  },

  /** `PidBranchPicker.tsx` — the intro screen's own picker, distinct from git's. */
  branch: {
    label: "Select branch",
    header: "Branch",
    searchPlaceholder: "Search or type new branch…",
    searchLabel: "Search or type new branch",
    create: "Create branch",
    none: "No branches",
    noMatches: "No matches",
  },

  /** `PidModelPicker.tsx`. Provider and model names are data. */
  modelPicker: {
    label: "Select model",
    searchPlaceholder: "Search options…",
    noMatches: "No models match",
    defaultBadge: "default",
    fallback: "model",
  },

  /** `PidRepoFileSearchDialog.tsx`. */
  repoSearch: {
    title: "Reference from repo",
    description:
      "Search project files and attach up to {max:number} as references for the next prompt.",
    searchLabel: "Search project files",
    placeholderLoading: "Loading project files…",
    placeholder: "Search files…",
    close: "Close",
    loading: "Loading…",
    noFiles: "No tracked files in this project.",
    noMatches: "No matches.",
    /** The `↑↓` / `↵` glyphs are keys, not words. */
    navHint: "↑↓ navigate · ↵ toggle",
    selected: "{count:number}/{max:number} selected",
    add: "Add",
    addCount: "Add ({count:number})",
    loadFailed: "Failed to list project files",
  },

  /** Toasts raised from the intro screens. */
  errors: {
    filePickerUnavailable: "File picker unavailable in this build",
    folderPickerUnavailable: "Folder picker unavailable in this build",
    notConnected: "Host not connected",
    openProjectFirst: "Open a project first",
  },
} as const;

export default intro;
