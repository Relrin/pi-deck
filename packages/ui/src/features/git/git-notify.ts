import { ll } from "../../i18n/t.js";
import { relativeTime } from "../../lib/format/relative-time.js";
import type { NotificationAction, NotificationInput } from "../_status/useNotificationStore.js";

/**
 * Stable notification IDs so a retry replaces the previous toast instead of stacking. The
 * id is per-project so two projects can each have an in-flight push without colliding.
 */
export const notifyIds = {
  commit: (projectId: string) => `git.commit:${projectId}`,
  push: (projectId: string) => `git.push:${projectId}`,
  pull: (projectId: string) => `git.pull:${projectId}`,
  openPr: (projectId: string) => `git.openPr:${projectId}`,
  rollback: (projectId: string) => `git.rollback:${projectId}`,
  stash: (projectId: string) => `git.stash:${projectId}`,
  stashPop: (projectId: string) => `git.stashPop:${projectId}`,
  refresh: (projectId: string) => `git.refresh:${projectId}`,
};

const DURATION = 8000;

/**
 * These builders are the reference example of *imperative* translation.
 *
 * They are plain functions called from `useGitStore` actions, not components, so they take their
 * strings from the module-level `ll()` — read inside each function body, never hoisted. A
 * module-level `const` holding a translated string would freeze whatever catalog happened to be
 * loaded at import time and would never update when the user switches language; that is exactly
 * why `pushReasonBody` and `pullReasonBody` below are functions rather than the `Record` constants
 * they used to be.
 *
 * `useNotificationStore` takes pre-formatted strings and is deliberately not locale-aware — the
 * caller translates, the store just transports.
 */

export interface CommitNotifyInput {
  branch?: string;
  shortSha: string;
  subject: string;
  fileCount: number;
  add: number;
  del: number;
  actions: NotificationAction[];
}

export function commitSuccessNotification(
  projectId: string,
  input: CommitNotifyInput,
): NotificationInput {
  const n = ll().git.notify.commit;
  return {
    id: notifyIds.commit(projectId),
    kind: "success",
    title: input.branch ? n.title({ branch: input.branch }) : n.titleNoBranch(),
    tag: n.tag(),
    body: input.subject,
    meta: n.meta({
      sha: input.shortSha,
      count: input.fileCount,
      add: input.add,
      del: input.del,
      when: relativeTime(Date.now()),
    }),
    actions: input.actions,
    durationMs: DURATION,
  };
}

export function commitFailureNotification(projectId: string, message: string): NotificationInput {
  const n = ll().git.notify.commit;
  return {
    id: notifyIds.commit(projectId),
    kind: "error",
    title: n.failedTitle(),
    tag: n.tag(),
    body: message,
    durationMs: DURATION,
  };
}

export interface PushSuccessInput {
  remote: string;
  branch: string;
  ahead: number;
  actions?: NotificationAction[];
}

export function pushSuccessNotification(
  projectId: string,
  input: PushSuccessInput,
): NotificationInput {
  const n = ll().git.notify.push;
  const count = input.ahead;
  return {
    id: notifyIds.push(projectId),
    kind: "success",
    title: n.title({ remote: input.remote, branch: input.branch }),
    tag: n.tag(),
    body: count > 0 ? n.sentUpstream({ count }) : n.upToDate(),
    actions: input.actions,
    durationMs: DURATION,
  };
}

export interface PushFailureInput {
  remote: string;
  branch: string;
  reason: "non_fast_forward" | "no_upstream" | "auth_failed" | "rejected" | "unknown";
  stderr: string;
  actions: NotificationAction[];
}

/**
 * A function, not a `Record` constant: see the note at the top of this file. The git commands
 * embedded in these strings are what the user would type, and must survive translation verbatim.
 */
function pushReasonBody(reason: PushFailureInput["reason"]): string {
  const r = ll().git.notify.push.reason;
  switch (reason) {
    case "non_fast_forward":
      return r.nonFastForward();
    case "no_upstream":
      return r.noUpstream();
    case "auth_failed":
      return r.authFailed();
    case "rejected":
      return r.rejected();
    default:
      return r.unknown();
  }
}

/** A function, not a `Record` constant — see the note at the top of this file. */
function pullReasonBody(reason: PullFailureInput["reason"]): string {
  const r = ll().git.notify.pull.reason;
  switch (reason) {
    case "conflict":
      return r.conflict();
    case "no_upstream":
      return r.noUpstream();
    case "auth_failed":
      return r.authFailed();
    default:
      return r.unknown();
  }
}

/**
 * Short label for a failure's metadata line, replacing the old `reason.replace(/_/g, "-")`. The
 * English values reproduce that slug byte for byte; nothing matches on them, so a translation is
 * free to use the local term.
 */
function reasonLabel(reason: PushFailureInput["reason"] | PullFailureInput["reason"]): string {
  const r = ll().git.reason;
  switch (reason) {
    case "non_fast_forward":
      return r.nonFastForward();
    case "no_upstream":
      return r.noUpstream();
    case "auth_failed":
      return r.authFailed();
    case "rejected":
      return r.rejected();
    case "conflict":
      return r.conflict();
    default:
      return r.unknown();
  }
}

export function pushFailureNotification(
  projectId: string,
  input: PushFailureInput,
): NotificationInput {
  const t = ll();
  const n = t.git.notify.push;
  return {
    id: notifyIds.push(projectId),
    kind: "error",
    title: n.failedTitle({ remote: input.remote }),
    tag: input.reason === "non_fast_forward" ? n.tagRejected() : n.tagFailed(),
    body: pushReasonBody(input.reason),
    meta: t.git.notify.remoteBranchMeta({
      remote: input.remote,
      branch: input.branch,
      reason: reasonLabel(input.reason),
    }),
    actions: input.actions,
    footnote: input.stderr
      ? { label: t.git.notify.viewLog(), onSelect: () => openLogWindow(input.stderr) }
      : undefined,
    durationMs: DURATION,
  };
}

export interface PullSuccessInput {
  remote: string;
  branch: string;
  rebased: boolean;
}

export function pullSuccessNotification(
  projectId: string,
  input: PullSuccessInput,
): NotificationInput {
  const n = ll().git.notify.pull;
  return {
    id: notifyIds.pull(projectId),
    kind: "success",
    title: n.title({ remote: input.remote, branch: input.branch }),
    tag: n.tag(),
    body: input.rebased ? n.rebased() : n.fastForwarded(),
    durationMs: DURATION,
  };
}

export interface PullFailureInput {
  remote: string;
  branch: string;
  reason: "conflict" | "no_upstream" | "auth_failed" | "unknown";
  stderr: string;
  actions?: NotificationAction[];
}

export function pullFailureNotification(
  projectId: string,
  input: PullFailureInput,
): NotificationInput {
  const t = ll();
  const n = t.git.notify.pull;
  return {
    id: notifyIds.pull(projectId),
    kind: "error",
    title: n.failedTitle({ remote: input.remote }),
    tag: n.tagFailed(),
    body: pullReasonBody(input.reason),
    meta: t.git.notify.remoteBranchMeta({
      remote: input.remote,
      branch: input.branch,
      reason: reasonLabel(input.reason),
    }),
    actions: input.actions,
    footnote: input.stderr
      ? { label: t.git.notify.viewLog(), onSelect: () => openLogWindow(input.stderr) }
      : undefined,
    durationMs: DURATION,
  };
}

export interface RollbackInput {
  fileCount: number;
}

export function rollbackSuccessNotification(
  projectId: string,
  input: RollbackInput,
): NotificationInput {
  const n = ll().git.notify.rollback;
  return {
    id: notifyIds.rollback(projectId),
    kind: "success",
    title: n.title(),
    tag: n.tag(),
    body: n.body({ count: input.fileCount }),
    durationMs: DURATION,
  };
}

export function rollbackFailureNotification(projectId: string, message: string): NotificationInput {
  const n = ll().git.notify.rollback;
  return {
    id: notifyIds.rollback(projectId),
    kind: "error",
    title: n.failedTitle(),
    tag: n.tag(),
    body: message,
    durationMs: DURATION,
  };
}

export interface StashSuccessInput {
  /** How many files the user explicitly selected — undefined means "everything". */
  selectedCount?: number;
}

export function stashSuccessNotification(
  projectId: string,
  input: StashSuccessInput,
  popAction: NotificationAction,
): NotificationInput {
  const n = ll().git.notify.stash;
  return {
    id: notifyIds.stash(projectId),
    kind: "success",
    title: n.title(),
    tag: n.tag(),
    body:
      input.selectedCount !== undefined
        ? n.bodySelected({ count: input.selectedCount })
        : n.bodyAll(),
    actions: [popAction],
    durationMs: DURATION,
  };
}

export function stashFailureNotification(
  projectId: string,
  reason: "no_changes" | "unknown",
  stderr: string,
): NotificationInput {
  const t = ll();
  const n = t.git.notify.stash;
  return {
    id: notifyIds.stash(projectId),
    kind: "error",
    title: n.failedTitle(),
    tag: n.tag(),
    body: reason === "no_changes" ? n.reason.noChanges() : n.reason.unknown(),
    footnote: stderr
      ? { label: t.git.notify.viewLog(), onSelect: () => openLogWindow(stderr) }
      : undefined,
    durationMs: DURATION,
  };
}

export function stashPopSuccessNotification(projectId: string): NotificationInput {
  const n = ll().git.notify.stashPop;
  return {
    id: notifyIds.stashPop(projectId),
    kind: "success",
    title: n.title(),
    tag: n.tag(),
    body: n.body(),
    durationMs: DURATION,
  };
}

export function stashPopFailureNotification(
  projectId: string,
  reason: "empty_stack" | "conflict" | "unknown",
  stderr: string,
): NotificationInput {
  const t = ll();
  const n = t.git.notify.stashPop;
  const body =
    reason === "empty_stack"
      ? n.reason.emptyStack()
      : reason === "conflict"
        ? n.reason.conflict()
        : n.reason.unknown();
  return {
    id: notifyIds.stashPop(projectId),
    kind: "error",
    title: n.failedTitle(),
    tag: n.tag(),
    body,
    footnote: stderr
      ? { label: t.git.notify.viewLog(), onSelect: () => openLogWindow(stderr) }
      : undefined,
    durationMs: DURATION,
  };
}

export function refreshSuccessNotification(projectId: string): NotificationInput {
  const n = ll().git.notify.refresh;
  return {
    id: notifyIds.refresh(projectId),
    kind: "info",
    title: n.title(),
    body: n.body(),
    durationMs: 3000,
  };
}

/**
 * Side-channel for showing the raw stderr of a failed git operation. For now this pops a
 * new window with a preformatted block; a proper "log viewer" panel can replace it later
 * without touching any caller.
 */
function openLogWindow(stderr: string): void {
  if (typeof window === "undefined") return;
  const win = window.open("", "_blank", "width=720,height=420,noopener");
  if (!win) return;
  const title = escapeHtml(ll().git.logWindowTitle());
  const html = `<!doctype html><html><head><title>${title}</title><style>
    body { background: #111; color: #eee; font-family: ui-monospace, Menlo, monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; }
  </style></head><body>${escapeHtml(stderr)}</body></html>`;
  win.document.write(html);
  win.document.close();
}

function escapeHtml(raw: string): string {
  return raw.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
}
