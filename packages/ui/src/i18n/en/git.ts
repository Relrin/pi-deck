/**
 * Strings for `features/git/`.
 *
 * The notification builders in `features/git/git-notify.ts` are the densest concentration of
 * *imperative* translation in the app: they are plain functions called from zustand actions, so
 * they read `ll()` inside the function body. Nothing here may be hoisted into a module-level
 * constant — that would capture whatever catalog was loaded at import time and never update when
 * the user switches language.
 *
 * Git's own vocabulary is not copy. Shell commands (`git push -u <remote> <branch>`) and the
 * command-shaped action label `pull --rebase` must survive translation verbatim.
 */
const git = {
  notify: {
    /** Rendered as the dimmer metadata line under a failure body. */
    remoteBranchMeta: "{remote:string}/{branch:string} · {reason:string}",
    /** Inline link that pops the raw git stderr. */
    viewLog: "view log",

    commit: {
      tag: "Commit",
      title: "Committed to {branch:string}",
      titleNoBranch: "Commit created",
      /** `when` is a localized relative time; `sha` is an identifier. */
      meta: "{sha:string} · {count:number} {{file|files}} · +{add:number} -{del:number} · {when:string}",
      failedTitle: "Commit failed",
    },

    push: {
      tag: "Push",
      tagRejected: "Push rejected",
      tagFailed: "Push failed",
      title: "Pushed to {remote:string}/{branch:string}",
      sentUpstream: "{count:number} {{commit|commits}} sent upstream.",
      upToDate: "Branch is up to date with origin.",
      failedTitle: "Push to {remote:string} failed",
      reason: {
        nonFastForward: "Remote has commits you don't have locally. Fast-forward refused.",
        noUpstream:
          "No upstream branch configured. Set one with `git push -u <remote> <branch>` first.",
        authFailed: "Authentication failed. Check your credentials or SSH key for this remote.",
        rejected: "Remote rejected the push (likely a pre-receive hook).",
        unknown: "Push failed. Open the log for details.",
      },
    },

    pull: {
      tag: "Pull",
      tagFailed: "Pull failed",
      title: "Pulled from {remote:string}/{branch:string}",
      rebased: "Rebased local commits on top.",
      fastForwarded: "Fast-forwarded local branch.",
      failedTitle: "Pull from {remote:string} failed",
      reason: {
        conflict: "Merge conflict — resolve in your editor, then commit to finish the pull.",
        noUpstream:
          "No upstream tracking branch. Set one with `git branch --set-upstream-to=<remote>/<branch>`.",
        authFailed: "Authentication failed. Check your credentials or SSH key.",
        unknown: "Pull failed. Open the log for details.",
      },
    },

    rollback: {
      tag: "Rollback",
      title: "Files rolled back",
      body: "{count:number} {{file|files}} restored to HEAD.",
      failedTitle: "Rollback failed",
    },

    stash: {
      tag: "Stash",
      title: "Changes stashed",
      bodySelected: "{count:number} {{file|files}} moved to the stash.",
      bodyAll: "Working tree stashed.",
      failedTitle: "Stash failed",
      reason: {
        noChanges: "Nothing to stash — working tree matches HEAD.",
        unknown: "Stash failed. Open the log for details.",
      },
    },

    stashPop: {
      tag: "Apply",
      title: "Stash applied",
      body: "Latest stash entry restored and dropped.",
      failedTitle: "Apply stash failed",
      reason: {
        emptyStack: "No stash entries to apply.",
        conflict: "Merge conflict while applying the stash — resolve in your editor, then commit.",
        unknown: "Stash pop failed. Open the log for details.",
      },
    },

    refresh: {
      title: "Git state refreshed",
      body: "Working tree, branches, and recent commits re-read from disk.",
    },
  },

  /**
   * Short machine-ish labels shown in a failure's metadata line. English reproduces the slug the
   * code used to derive with `reason.replace(/_/g, "-")` byte for byte; a translation may use the
   * local term, since this is read by a person and not matched by anything.
   */
  reason: {
    nonFastForward: "non-fast-forward",
    noUpstream: "no-upstream",
    authFailed: "auth-failed",
    rejected: "rejected",
    unknown: "unknown",
    conflict: "conflict",
  },

  /** Title of the popped raw-stderr window. */
  logWindowTitle: "git log",

  /**
   * Notification action buttons, composed in `useGitStore.ts`. `pullRebase` is the literal git
   * command and must not be translated — it is what the user would type.
   */
  actions: {
    view: "view",
    undo: "undo",
    push: "push",
    apply: "apply",
    pullRebase: "pull --rebase",
    forcePush: "force push",
  },

  /**
   * Fallbacks passed to `humanizeError(err, …)`. They are used only when the host sent no
   * recognisable error code and no message of its own.
   */
  errors: {
    loadBranches: "Failed to load branches",
    checkoutBranch: "Failed to checkout branch",
    createBranch: "Failed to create branch",
    readStatus: "Failed to read git status",
    initRepo: "Failed to initialise repository",
    openPrUrl: "Failed to open PR URL",
    undo: "Undo failed",
    resolveCommitUrl: "Failed to resolve commit URL",
    copy: "Copy failed",
  },

  /** Composed in `useGitStore.ts` rather than in a builder. */
  store: {
    noFilesSelected: "No files selected.",
    copiedToClipboard: 'Copied "{name:string}" to clipboard',
  },

  /** `GitSidebar.tsx`'s three placeholder states, before any repo data exists. */
  sidebar: {
    noSession: "Start or open a session to see git state.",
    loading: "Reading git…",
    noData: "No git data.",
  },

  /** `EmptyState.tsx` — the project is not a repo yet. */
  empty: {
    title: "Not a git repository",
    blurb:
      "This project isn’t tracked by git. Initialise a repo to enable the changes list, commit history, and the agent’s file-touch trail.",
    init: "Initialise repository",
  },

  /**
   * `BranchHeader.tsx`. The three action labels are lower-case on purpose — they match the
   * surrounding chrome, not sentence case.
   */
  branch: {
    sectionLabel: "branch",
    noRemote: "no remote configured",
    pull: "pull",
    push: "push",
    openPr: "open pr",
    /** Tooltip and a11y name for a disabled action. Two forms because the tooltip is wider. */
    disabledTooltip: "{label:string} — {reason:string}",
    disabledLabel: "{label:string} ({reason:string})",
  },

  /** `BranchPicker.tsx`. Branch names themselves are refs and never translate. */
  picker: {
    select: "Select branch",
    copyName: "Copy branch name",
    current: "Current",
    recent: "Recent",
    merged: "merged",
    searchPlaceholder: "switch to branch…",
    searchLabel: "Search branches",
    newBranchPlaceholder: "new branch from {branch:string}",
    newBranchLabel: "Create new branch from {branch:string}",
    loadFailed: "Failed to load branches: {error:string}",
    loading: "Loading branches…",
    none: "No branches.",
    noneYet: "No branches yet.",
    noMatches: 'No branches match "{query:string}".',
  },

  /** `ChangesList.tsx`. The `+ ○ − ?` glyphs beside the group labels are not copy. */
  changes: {
    sectionLabel: "changes",
    stageAll: "stage all",
    stageAllTitle: "Select all files for the next commit",
    clean: "working tree clean",
    toggleHunk: "Toggle hunk {index:number} of {total:number}",
    /** Per-hunk meta line. `{range}` is a `L12-L20` line span and is not copy. */
    hunkMeta: "hunk {index:number}/{total:number} · {range:string}",
    group: {
      added: "added",
      modified: "modified",
      deleted: "deleted",
      untracked: "untracked",
    },
  },

  /** `ChangeRow.tsx`. `{path}` is a file path and passes through untranslated. */
  row: {
    touched: "{path:string} · touched by current session",
    stage: "Stage {path:string}",
    openInEditor: "Open file in editor",
    rollback: "Rollback",
  },

  /** `ChangesToolbar.tsx`. Each action has a label plus a title that changes with selection. */
  toolbar: {
    label: "Working tree actions",
    refresh: "refresh",
    refreshTitle: "Refresh git state from disk",
    rollback: "rollback",
    rollbackTitle: "Rollback selected files to HEAD",
    rollbackTitleEmpty: "Select files to roll back",
    stash: "stash",
    stashTitleSelected: "Stash selected changes",
    stashTitleAll: "Stash all working-tree changes",
    apply: "apply",
    applyTitle: "Apply and drop the latest stash entry",
  },

  /**
   * `CommitComposer.tsx`. Distinct from `notify.commit`, which is the *result* of committing.
   * `--force-with-lease` beside the force-push checkbox is the literal flag and stays as it is.
   */
  composer: {
    sectionLabel: "commit",
    placeholder: "describe the change…",
    amend: "amend previous commit",
    forcePush: "force push",
    /** The literal git flag the checkbox sets. Shown so the user recognises it; never translated. */
    forceWithLeaseFlag: "--force-with-lease",
    /** Button faces, lower-case to match the surrounding chrome. */
    commit: "commit",
    commitPush: "commit & push",
    submit: "Commit",
    submitDisabled: "Enter a commit message",
    submitPush: "Commit & push",
  },

  /**
   * `GroupModeMenu.tsx`. `trigger` is spliced with the current value through `i18n/rich.tsx` so a
   * translation can put the value first; the `value` labels are the short forms.
   */
  groupMenu: {
    label: "Group changes by",
    header: "Group changes by",
    trigger: "group: {value:string}",
    option: {
      file: { label: "File", description: "one row per file (default)", value: "file" },
      hunk: { label: "Hunk", description: "expand each file into its hunks", value: "hunk" },
      change: {
        label: "Change type",
        description: "added · modified · deleted",
        value: "change type",
      },
      folder: { label: "Folder", description: "group by parent directory", value: "folder" },
    },
  },
} as const;

export default git;
