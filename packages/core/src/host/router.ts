import {
  checkoutBranch,
  checkoutPaths,
  createBranch,
  currentBranch,
  GitNotFoundError,
  getCommitUrl,
  getDiffHunks,
  getPrUrl,
  commit as gitCommit,
  pull as gitPull,
  push as gitPush,
  stash as gitStash,
  stashPop as gitStashPop,
  initRepo,
  listBranches,
  listProjectFiles,
  NotARepoError,
  resetSoftHeadParent,
} from "../git/index.js";
import { getRecentCommits } from "../git/log.js";
import { type CommandName, CommandSchemas } from "../protocol/commands.js";
import type { GitWatchManager } from "./git-watch-manager.js";
import type { MetadataStore } from "./metadata-store.js";
import type { ProviderManager } from "./provider-manager.js";
import type { SessionManager, SessionRecord } from "./session-manager.js";
import type { ThemeManager } from "./themes/index.js";
import type { TurnTracker } from "./turn-tracker.js";

export interface RouterContext {
  metadataStore: MetadataStore;
  sessionManager: SessionManager;
  themeManager: ThemeManager;
  providerManager: ProviderManager;
  gitWatchManager: GitWatchManager;
  turnTracker: TurnTracker;
  hostVersion: string;
  protocolVersion: number;
}

export class RouterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export type CommandHandler = (ctx: RouterContext, payload: unknown) => Promise<unknown>;

function toSummary(record: SessionRecord) {
  return {
    id: record.id,
    projectId: record.projectId,
    title: record.title,
    model: record.modelRef ? `${record.modelRef.providerId}/${record.modelRef.modelId}` : undefined,
    modelRef: record.modelRef,
    thinkingLevel: record.thinkingLevel,
    agentMode: record.agentMode,
    createdAt: record.createdAt,
    lastActivityAt: record.lastActivityAt,
    branch: record.branch,
    archived: record.archived,
  };
}

function mapGitError(err: unknown): never {
  if (err instanceof GitNotFoundError) {
    throw new RouterError("git_not_found", err.message);
  }
  if (err instanceof NotARepoError) {
    throw new RouterError("not_a_repo", err.message);
  }
  throw err instanceof Error ? new RouterError("git_failed", err.message) : err;
}

const handlers: { [C in CommandName]: CommandHandler } = {
  ping: async (ctx) => ({
    pong: true as const,
    hostVersion: ctx.hostVersion,
    protocolVersion: ctx.protocolVersion,
  }),
  "project.list": async (ctx) => ({ projects: await ctx.metadataStore.listProjects() }),
  "project.open": async (ctx, payload) => {
    const parsed = CommandSchemas["project.open"].request.parse(payload);
    const project = await ctx.metadataStore.openOrCreateProject(parsed.path);
    return { project };
  },
  "session.list": async (ctx, payload) => {
    const parsed = CommandSchemas["session.list"].request.parse(payload);
    await ctx.sessionManager.rehydrateProject(parsed.projectId);
    const records = ctx.sessionManager.list(parsed.projectId);
    return { sessions: records.map(toSummary) };
  },
  "session.create": async (ctx, payload) => {
    const parsed = CommandSchemas["session.create"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    const record = await ctx.sessionManager.create({
      projectId: project.id,
      projectPath: project.path,
      title: parsed.title,
      modelRef: parsed.modelRef,
      thinkingLevel: parsed.thinkingLevel,
      agentMode: parsed.agentMode,
    });
    await ctx.metadataStore.appendSessionId(project.id, record.id);
    return { session: toSummary(record) };
  },
  "session.activate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.activate"].request.parse(payload);
    await ctx.sessionManager.activate(parsed.sessionId);
    return { ok: true as const };
  },
  "session.deactivate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.deactivate"].request.parse(payload);
    await ctx.sessionManager.deactivate(parsed.sessionId);
    ctx.turnTracker.forget(parsed.sessionId);
    return { ok: true as const };
  },
  "session.prompt": async (ctx, payload) => {
    const parsed = CommandSchemas["session.prompt"].request.parse(payload);
    const result = await ctx.sessionManager.prompt(parsed.sessionId, parsed.text, {
      agentMode: parsed.agentMode,
      attachments: parsed.attachments,
      images: parsed.images,
    });
    return { accepted: true as const, promptId: result.promptId };
  },
  "session.cancel": async (ctx, payload) => {
    const parsed = CommandSchemas["session.cancel"].request.parse(payload);
    await ctx.sessionManager.cancel(parsed.sessionId);
    return { ok: true as const };
  },
  "session.archive": async (ctx, payload) => {
    const parsed = CommandSchemas["session.archive"].request.parse(payload);
    await ctx.sessionManager.archive(parsed.sessionId);
    return { ok: true as const };
  },
  "session.unarchive": async (ctx, payload) => {
    const parsed = CommandSchemas["session.unarchive"].request.parse(payload);
    await ctx.sessionManager.unarchive(parsed.sessionId);
    return { ok: true as const };
  },
  "session.delete": async (ctx, payload) => {
    const parsed = CommandSchemas["session.delete"].request.parse(payload);
    await ctx.sessionManager.delete(parsed.sessionId);
    ctx.turnTracker.forget(parsed.sessionId);
    return { ok: true as const };
  },
  "session.rename": async (ctx, payload) => {
    const parsed = CommandSchemas["session.rename"].request.parse(payload);
    await ctx.sessionManager.rename(parsed.sessionId, parsed.title);
    return { ok: true as const };
  },
  "session.listArchived": async (ctx) => {
    await ctx.sessionManager.rehydrateAll();
    return { sessions: ctx.sessionManager.listArchived().map(toSummary) };
  },
  "session.setModel": async (ctx, payload) => {
    const parsed = CommandSchemas["session.setModel"].request.parse(payload);
    await ctx.sessionManager.setModel(parsed.sessionId, parsed.modelRef, parsed.thinkingLevel);
    return { ok: true as const };
  },
  "session.setThinkingLevel": async (ctx, payload) => {
    const parsed = CommandSchemas["session.setThinkingLevel"].request.parse(payload);
    await ctx.sessionManager.setThinkingLevel(parsed.sessionId, parsed.level);
    return { ok: true as const };
  },
  "session.toolApproval": async (ctx, payload) => {
    const parsed = CommandSchemas["session.toolApproval"].request.parse(payload);
    await ctx.sessionManager.resolveApproval(
      parsed.sessionId,
      parsed.approvalId,
      parsed.decision,
      parsed.reason,
    );
    return { ok: true as const };
  },
  "project.listFiles": async (ctx, payload) => {
    const parsed = CommandSchemas["project.listFiles"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const entries = await listProjectFiles(project.path, parsed.limit);
      return { entries };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.listBranches": async (ctx, payload) => {
    const parsed = CommandSchemas["git.listBranches"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const branches = await listBranches(project.path);
      return { branches };
    } catch (err) {
      if (err instanceof NotARepoError) return { branches: [] };
      mapGitError(err);
    }
  },
  "git.currentBranch": async (ctx, payload) => {
    const parsed = CommandSchemas["git.currentBranch"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      return { name: await currentBranch(project.path) };
    } catch (err) {
      if (err instanceof NotARepoError) return { name: "" };
      mapGitError(err);
    }
  },
  "git.checkoutBranch": async (ctx, payload) => {
    const parsed = CommandSchemas["git.checkoutBranch"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await checkoutBranch(project.path, parsed.name);
      return { ok: true as const };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.createBranch": async (ctx, payload) => {
    const parsed = CommandSchemas["git.createBranch"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await createBranch(project.path, parsed.name);
      return { ok: true as const };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.status": async (ctx, payload) => {
    const parsed = CommandSchemas["git.status"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const status = await ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return { status };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.log": async (ctx, payload) => {
    const parsed = CommandSchemas["git.log"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const commits = await getRecentCommits(project.path, parsed.limit);
      return { commits };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.diffHunks": async (ctx, payload) => {
    const parsed = CommandSchemas["git.diffHunks"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const map = await getDiffHunks(project.path);
      return { hunksByPath: Object.fromEntries(map) };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.commit": async (ctx, payload) => {
    const parsed = CommandSchemas["git.commit"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const result = await gitCommit(project.path, {
        message: parsed.message,
        amend: parsed.amend,
        paths: parsed.paths,
      });
      // A fresh commit is a working-tree change — kick the watcher so the renderer
      // refreshes status/log without an extra round-trip.
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return result;
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.push": async (ctx, payload) => {
    const parsed = CommandSchemas["git.push"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const outcome = await gitPush(project.path, { forceWithLease: parsed.forceWithLease });
      // Regardless of outcome, the ahead/behind state may have moved — refresh so the
      // branch header reflects reality even if the push itself failed.
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return outcome;
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.pull": async (ctx, payload) => {
    const parsed = CommandSchemas["git.pull"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const outcome = await gitPull(project.path, { rebase: parsed.rebase });
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return outcome;
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.resetSoftHeadParent": async (ctx, payload) => {
    const parsed = CommandSchemas["git.resetSoftHeadParent"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await resetSoftHeadParent(project.path);
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return { ok: true as const };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.openPrUrl": async (ctx, payload) => {
    const parsed = CommandSchemas["git.openPrUrl"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      return await getPrUrl(project.path, parsed.remote);
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.commitUrl": async (ctx, payload) => {
    const parsed = CommandSchemas["git.commitUrl"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      return await getCommitUrl(project.path, parsed.sha, parsed.remote);
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.checkoutPaths": async (ctx, payload) => {
    const parsed = CommandSchemas["git.checkoutPaths"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await checkoutPaths(project.path, {
        tracked: parsed.tracked,
        untracked: parsed.untracked,
      });
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return { ok: true as const };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.stash": async (ctx, payload) => {
    const parsed = CommandSchemas["git.stash"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const outcome = await gitStash(project.path, {
        message: parsed.message,
        paths: parsed.paths,
        includeUntracked: parsed.includeUntracked,
      });
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return outcome;
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.stashPop": async (ctx, payload) => {
    const parsed = CommandSchemas["git.stashPop"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const outcome = await gitStashPop(project.path);
      void ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return outcome;
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.init": async (ctx, payload) => {
    const parsed = CommandSchemas["git.init"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await initRepo(project.path);
      // Trigger a status refresh so the renderer transitions out of the empty state.
      await ctx.gitWatchManager.getOrLoad(parsed.projectId);
      return { ok: true as const };
    } catch (err) {
      mapGitError(err);
    }
  },
  "git.turnTouches": async (ctx, payload) => {
    const parsed = CommandSchemas["git.turnTouches"].request.parse(payload);
    return ctx.turnTracker.getFor(parsed.sessionId);
  },
  "theme.list": async (ctx) => ({
    activeName: ctx.themeManager.getActiveName(),
    themes: ctx.themeManager.list(),
  }),
  "theme.get": async (ctx, payload) => {
    const parsed = CommandSchemas["theme.get"].request.parse(payload);
    const theme = ctx.themeManager.get(parsed.name);
    if (!theme) throw new RouterError("not_found", `Unknown theme: ${parsed.name}`);
    return { theme };
  },
  "theme.setActive": async (ctx, payload) => {
    const parsed = CommandSchemas["theme.setActive"].request.parse(payload);
    await ctx.themeManager.setActive(parsed.name);
    return { ok: true as const };
  },
  "theme.import": async (ctx, payload) => {
    const parsed = CommandSchemas["theme.import"].request.parse(payload);
    const result = await ctx.themeManager.importFromPath(parsed.sourcePath);
    return { name: result.name };
  },
  "provider.list": async (ctx) => ctx.providerManager.listProviders(),
  "provider.models": async (ctx, payload) => {
    const parsed = CommandSchemas["provider.models"].request.parse(payload);
    const models = await ctx.providerManager.listModels(parsed.providerId);
    return { providerId: parsed.providerId, models };
  },
  "provider.addCustom": async (ctx, payload) => {
    const parsed = CommandSchemas["provider.addCustom"].request.parse(payload);
    const provider = await ctx.providerManager.addCustom(parsed.def);
    return { id: provider.id, provider };
  },
  "provider.removeCustom": async (ctx, payload) => {
    const parsed = CommandSchemas["provider.removeCustom"].request.parse(payload);
    await ctx.providerManager.removeCustom(parsed.id);
    return { ok: true as const };
  },
  "provider.setApiKey": async (ctx, payload) => {
    const parsed = CommandSchemas["provider.setApiKey"].request.parse(payload);
    ctx.providerManager.setApiKey(parsed.authJsonKey, parsed.secret);
    return { ok: true as const };
  },
  "provider.clearApiKey": async (ctx, payload) => {
    const parsed = CommandSchemas["provider.clearApiKey"].request.parse(payload);
    ctx.providerManager.clearApiKey(parsed.authJsonKey);
    return { ok: true as const };
  },
};

export async function dispatch(
  ctx: RouterContext,
  cmd: string,
  payload: unknown,
): Promise<unknown> {
  if (!(cmd in handlers)) {
    throw new RouterError("unknown_command", `Unknown command: ${cmd}`);
  }
  const handler = handlers[cmd as CommandName];
  return handler(ctx, payload);
}
