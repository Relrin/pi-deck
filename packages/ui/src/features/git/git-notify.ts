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
};

const DURATION = 8000;

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
  return {
    id: notifyIds.commit(projectId),
    kind: "success",
    title: input.branch ? `Committed to ${input.branch}` : "Commit created",
    tag: "Commit",
    body: input.subject,
    meta: `${input.shortSha} · ${input.fileCount} file${input.fileCount === 1 ? "" : "s"} · +${input.add} -${input.del} · just now`,
    actions: input.actions,
    durationMs: DURATION,
  };
}

export function commitFailureNotification(projectId: string, message: string): NotificationInput {
  return {
    id: notifyIds.commit(projectId),
    kind: "error",
    title: "Commit failed",
    tag: "Commit",
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
  const count = input.ahead;
  return {
    id: notifyIds.push(projectId),
    kind: "success",
    title: `Pushed to ${input.remote}/${input.branch}`,
    tag: "Push",
    body:
      count > 0
        ? `${count} commit${count === 1 ? "" : "s"} sent upstream.`
        : "Branch is up to date with origin.",
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

const PUSH_REASON_BODY: Record<PushFailureInput["reason"], string> = {
  non_fast_forward: "Remote has commits you don't have locally. Fast-forward refused.",
  no_upstream: "No upstream branch configured. Set one with `git push -u <remote> <branch>` first.",
  auth_failed: "Authentication failed. Check your credentials or SSH key for this remote.",
  rejected: "Remote rejected the push (likely a pre-receive hook).",
  unknown: "Push failed. Open the log for details.",
};

export function pushFailureNotification(
  projectId: string,
  input: PushFailureInput,
): NotificationInput {
  const reasonTag = input.reason === "non_fast_forward" ? "Push rejected" : "Push failed";
  return {
    id: notifyIds.push(projectId),
    kind: "error",
    title: `Push to ${input.remote} failed`,
    tag: reasonTag,
    body: PUSH_REASON_BODY[input.reason],
    meta: `${input.remote}/${input.branch} · ${input.reason.replace(/_/g, "-")}`,
    actions: input.actions,
    footnote: input.stderr
      ? { label: "view log", onSelect: () => openLogWindow(input.stderr) }
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
  return {
    id: notifyIds.pull(projectId),
    kind: "success",
    title: `Pulled from ${input.remote}/${input.branch}`,
    tag: "Pull",
    body: input.rebased ? "Rebased local commits on top." : "Fast-forwarded local branch.",
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

const PULL_REASON_BODY: Record<PullFailureInput["reason"], string> = {
  conflict: "Merge conflict — resolve in your editor, then commit to finish the pull.",
  no_upstream:
    "No upstream tracking branch. Set one with `git branch --set-upstream-to=<remote>/<branch>`.",
  auth_failed: "Authentication failed. Check your credentials or SSH key.",
  unknown: "Pull failed. Open the log for details.",
};

export function pullFailureNotification(
  projectId: string,
  input: PullFailureInput,
): NotificationInput {
  return {
    id: notifyIds.pull(projectId),
    kind: "error",
    title: `Pull from ${input.remote} failed`,
    tag: "Pull failed",
    body: PULL_REASON_BODY[input.reason],
    meta: `${input.remote}/${input.branch} · ${input.reason.replace(/_/g, "-")}`,
    actions: input.actions,
    footnote: input.stderr
      ? { label: "view log", onSelect: () => openLogWindow(input.stderr) }
      : undefined,
    durationMs: DURATION,
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
  const html = `<!doctype html><html><head><title>git log</title><style>
    body { background: #111; color: #eee; font-family: ui-monospace, Menlo, monospace; font-size: 12px; padding: 16px; white-space: pre-wrap; }
  </style></head><body>${stderr.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c)}</body></html>`;
  win.document.write(html);
  win.document.close();
}
