/**
 * Strings for `features/sessions/`.
 *
 * **Session titles are data, not copy.** `"New session"`, `` `Fork of …` `` and
 * `"Untitled session"` are generated host-side in `packages/core/src/host/session-manager.ts` and
 * persisted on `SessionMetadata`, so they arrive at the renderer as the session's name — the same
 * field the user can rename. Only `title.new` below is used, and only at *creation* time:
 * `SessionCreateRequest.title` is already optional, so the renderer supplies a localized title
 * rather than letting the host default apply. Fork and discovery titles stay English because
 * neither path accepts a title without a protocol change, and renaming a persisted session behind
 * the user's back would be worse than an English word.
 */
const sessions = {
  filter: {
    /** Project-filter summary in the sessions toolbar. */
    selectedCount: "{count:number} selected",
    label: "Filter sessions",
    controls: "Sort, group, and filter sessions",
    searchPlaceholder: "filter sessions…",
    projectPlaceholder: "filter project…",
    all: "All",
    noMatches: "no matches",
    defaults: "defaults",
    activeCount: "{count:number} active",
    reset: "reset",
    done: "done",
    /** Summary words for the project selection, shown beside the section label. */
    summaryAll: "all",
    summaryNone: "none",
    section: {
      project: "project",
      since: "since",
      sort: "sort",
      group: "group",
    },
    /** `since` values are durations (`7d`), not words — only `all` is copy. */
    since: {
      all: "all",
    },
    sort: {
      recent: "recent",
      created: "created",
      branch: "branch",
      status: "status",
    },
    group: {
      workspace: "workspace",
      branch: "branch",
      status: "status",
      flat: "flat",
    },
  },

  /** Title the renderer sends with `session.create`, so a new session is named in the UI locale. */
  title: {
    new: "New session",
  },

  /** `PidNewSessionButton.tsx`. */
  newButton: {
    label: "New session",
    disabled: "Open a project first",
    caption: "new session",
  },

  /** `PidSessionsList.tsx`. */
  list: {
    archive: "archive",
    showLess: "show less",
    showMore: "{count:number} more",
    noProjects: "no projects",
    noProjectsMatch: "no projects match the filter",
  },

  /**
   * `PidSessionRow.tsx`. The status dot's accessible name per rail state; `idle` is deliberately
   * unlabelled, because naming every quiet row is screen-reader noise.
   */
  row: {
    title: "Session title",
    status: {
      working: "Running",
      waiting: "Waiting for your input",
      done: "Finished",
      failed: "Failed",
    },
    menu: {
      markCompleted: "Mark as completed",
      rename: "Rename",
      unarchive: "Unarchive",
      archive: "Archive",
      delete: "Delete",
    },
    confirmDeleteTitle: "Delete session?",
    /** `{title}` is the session's own name and passes through untranslated. */
    confirmDeleteBody:
      '"{title:string}" and its conversation history will be removed permanently. This can\'t be undone.',
    confirmDeleteLabel: "Delete",
  },

  /** Fallbacks passed to `humanizeError(err, …)`, and two connection-time failures. */
  errors: {
    loadWorkspace: "Failed to load workspace",
    loadSessions: "Failed to load sessions",
    createSession: "Failed to create session",
    loadArchived: "Failed to load archived sessions",
    archive: "Failed to archive session",
    unarchive: "Failed to unarchive session",
    rename: "Failed to rename session",
    delete: "Failed to delete session",
    open: "Failed to open session",
    sendPrompt: "Failed to send prompt",
    cancel: "Failed to cancel",
    forceStop: "Failed to force-stop",
    fork: "Failed to fork session",
    rewind: "Failed to rewind",
    openProject: "Failed to open project",
    loadProjects: "Failed to load projects",
    noBridge: "Preload bridge not available",
    noConnectionInfo: "Backend did not provide connection info",
  },
} as const;

export default sessions;
