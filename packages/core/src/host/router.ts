import {
  FsExistsError,
  createFile as fsCreateFile,
  createFolder as fsCreateFolder,
  move as fsMove,
  readTextFile as fsReadTextFile,
  rename as fsRename,
  trashPaths as fsTrashPaths,
  writeTextFile as fsWriteTextFile,
  IllegalNameError,
  PathEscapeError,
} from "../fs/index.js";
import {
  checkoutBranch,
  checkoutPaths,
  createBranch,
  currentBranch,
  diffForPath,
  fileAtHead,
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
import type { CustomLspServersStore } from "../lsp/custom-servers-store.js";
import { type LanguageServerManager, LspManagerError } from "../lsp/manager.js";
import { type CommandName, CommandSchemas } from "../protocol/commands.js";
import type { TerminalManager } from "../terminal/index.js";
import type { ArtefactsTracker } from "./artefacts-tracker.js";
import type { FsWatchManager } from "./fs-watch-manager.js";
import type { GitWatchManager } from "./git-watch-manager.js";
import {
  applyServerConfig,
  applyServerToken,
  clearAdapterCacheEntry,
  getAdapterStatus,
  listServers as listMcpServers,
  type McpCatalogStore,
  projectMcpConfigPath,
  searchRegistry,
  setProjectServer,
  toAdapterEntry,
} from "./mcp.js";
import type { McpSecretsStore } from "./mcp-secrets.js";
import type { MetadataStore } from "./metadata-store.js";
import { PlanFileWatcher } from "./plan-file-watcher.js";
import type { ProviderManager } from "./provider-manager.js";
import type { ReviewStore } from "./review-store.js";
import type { SessionManager, SessionRecord } from "./session-manager.js";
import {
  installSelectedSkills,
  installSkillFolder,
  listProjectCommands,
  listSkills,
  scanRepoSkills,
  uninstallSkill,
} from "./skills.js";
import type { ThemeManager } from "./themes/index.js";
import type { TurnTracker } from "./turn-tracker.js";

export interface RouterContext {
  metadataStore: MetadataStore;
  sessionManager: SessionManager;
  themeManager: ThemeManager;
  providerManager: ProviderManager;
  gitWatchManager: GitWatchManager;
  fsWatchManager: FsWatchManager;
  planFileWatcher: PlanFileWatcher;
  turnTracker: TurnTracker;
  artefactsTracker: ArtefactsTracker;
  reviewStore: ReviewStore;
  terminalManager: TerminalManager;
  languageServerManager: LanguageServerManager;
  customLspServersStore: CustomLspServersStore;
  mcpCatalogStore: McpCatalogStore;
  mcpSecretsStore: McpSecretsStore;
  /** Bundled pi-mcp-adapter version resolved by the desktop app, or null when absent. */
  mcpAdapterVersion: string | null;
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
    excludedTools: record.excludedTools,
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

function mapLspError(err: unknown): never {
  if (err instanceof LspManagerError) {
    throw new RouterError(err.code, err.message);
  }
  throw err instanceof Error ? new RouterError("lsp_failed", err.message) : err;
}

function mapFsError(err: unknown): never {
  if (err instanceof PathEscapeError) {
    throw new RouterError("path_escape", err.message);
  }
  if (err instanceof IllegalNameError) {
    throw new RouterError("illegal_name", err.message);
  }
  if (err instanceof FsExistsError) {
    throw new RouterError("fs_exists", err.message);
  }
  throw err instanceof Error ? new RouterError("fs_failed", err.message) : err;
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
      planGatePolicy: parsed.planGatePolicy,
      excludedTools: parsed.excludedTools,
    });
    await ctx.metadataStore.appendSessionId(project.id, record.id);
    return { session: toSummary(record) };
  },
  "session.activate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.activate"].request.parse(payload);
    await ctx.sessionManager.activate(parsed.sessionId);
    // Start streaming plan-file changes for this session. The watcher emits the current
    // content (or null) immediately so a PlanPanel opened later sees state without an extra
    // `plan.file.read` round-trip. Idempotent — repeated activations don't double-watch.
    const record = ctx.sessionManager.get(parsed.sessionId);
    if (record) ctx.planFileWatcher.ensure(parsed.sessionId, record.projectPath);
    return { ok: true as const };
  },
  "session.deactivate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.deactivate"].request.parse(payload);
    await ctx.sessionManager.deactivate(parsed.sessionId);
    ctx.turnTracker.forget(parsed.sessionId);
    ctx.artefactsTracker.forget(parsed.sessionId);
    await ctx.planFileWatcher.stop(parsed.sessionId);
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
  "session.forceStop": async (ctx, payload) => {
    const parsed = CommandSchemas["session.forceStop"].request.parse(payload);
    ctx.sessionManager.forceStop(parsed.sessionId);
    return { ok: true as const };
  },
  "session.commands": async (ctx, payload) => {
    const parsed = CommandSchemas["session.commands"].request.parse(payload);
    return await ctx.sessionManager.commands(parsed.sessionId);
  },
  "project.commands": async (ctx, payload) => {
    const parsed = CommandSchemas["project.commands"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    return { commands: await listProjectCommands(project.path) };
  },
  "skills.list": async (ctx, payload) => {
    const parsed = CommandSchemas["skills.list"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    return listSkills(project.path);
  },
  "skills.scan": async (_ctx, payload) => {
    const parsed = CommandSchemas["skills.scan"].request.parse(payload);
    try {
      return await scanRepoSkills(parsed.url);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
  },
  "skills.install": async (_ctx, payload) => {
    const parsed = CommandSchemas["skills.install"].request.parse(payload);
    try {
      return parsed.source.kind === "scan"
        ? await installSelectedSkills(parsed.source.scanId, parsed.source.skillIds)
        : await installSkillFolder(parsed.source.path);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
  },
  "skills.uninstall": async (ctx, payload) => {
    const parsed = CommandSchemas["skills.uninstall"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    try {
      await uninstallSkill({ filePath: parsed.filePath, baseDir: parsed.baseDir }, project?.path);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    return { ok: true as const };
  },
  "mcp.list": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.list"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    const servers = await listMcpServers(project.path, ctx.mcpCatalogStore.list(), {
      tokenNames: new Set(ctx.mcpSecretsStore.names()),
    });
    // Prefer the version the desktop app resolved from its own node_modules; fall back to
    // probing the agent's extensions dir (covers a manual `pi install`).
    const adapter = ctx.mcpAdapterVersion
      ? { installed: true, version: ctx.mcpAdapterVersion }
      : await getAdapterStatus();
    return { servers, adapter, configPath: projectMcpConfigPath(project.path) };
  },
  "mcp.registrySearch": async (_ctx, payload) => {
    const parsed = CommandSchemas["mcp.registrySearch"].request.parse(payload);
    try {
      return await searchRegistry(parsed.query, parsed.cursor);
    } catch (err) {
      throw new RouterError("registry_failed", (err as Error).message);
    }
  },
  "mcp.install": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.install"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await ctx.mcpCatalogStore.upsert(parsed.spec);
      await setProjectServer(project.path, parsed.spec.name, toAdapterEntry(parsed.spec));
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    return { ok: true as const, name: parsed.spec.name };
  },
  "mcp.setProjectEnabled": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.setProjectEnabled"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      if (parsed.enabled) {
        const spec = ctx.mcpCatalogStore.get(parsed.name);
        if (!spec) {
          throw new Error(`"${parsed.name}" is not in the catalog — reinstall it first`);
        }
        await setProjectServer(project.path, parsed.name, toAdapterEntry(spec));
      } else {
        await setProjectServer(project.path, parsed.name, null);
      }
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    return { ok: true as const };
  },
  "mcp.uninstall": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.uninstall"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await ctx.mcpCatalogStore.delete(parsed.name);
      await setProjectServer(project.path, parsed.name, null);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    return { ok: true as const };
  },
  "mcp.setConfig": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.setConfig"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    const changes: Partial<{
      lifecycle: typeof parsed.lifecycle;
      expose: typeof parsed.expose;
      idleTimeout: number;
    }> = {};
    if (parsed.lifecycle !== undefined) changes.lifecycle = parsed.lifecycle;
    if (parsed.expose !== undefined) changes.expose = parsed.expose;
    if (parsed.idleTimeout !== undefined) changes.idleTimeout = parsed.idleTimeout;
    try {
      await applyServerConfig(ctx.mcpCatalogStore, project.path, parsed.name, changes);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    return { ok: true as const };
  },
  "mcp.reconnect": async (_ctx, payload) => {
    const parsed = CommandSchemas["mcp.reconnect"].request.parse(payload);
    await clearAdapterCacheEntry(parsed.name);
    return { ok: true as const };
  },
  "mcp.setToken": async (ctx, payload) => {
    const parsed = CommandSchemas["mcp.setToken"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await applyServerToken(
        ctx.mcpCatalogStore,
        ctx.mcpSecretsStore,
        project.path,
        parsed.name,
        parsed.token,
      );
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
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
    ctx.artefactsTracker.forget(parsed.sessionId);
    await ctx.planFileWatcher.stop(parsed.sessionId);
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
  "session.getForkPoints": async (ctx, payload) => {
    const parsed = CommandSchemas["session.getForkPoints"].request.parse(payload);
    return await ctx.sessionManager.getForkPoints(parsed.sessionId);
  },
  "session.rewindTo": async (ctx, payload) => {
    const parsed = CommandSchemas["session.rewindTo"].request.parse(payload);
    return await ctx.sessionManager.rewindTo(
      parsed.sessionId,
      parsed.entryId,
      parsed.userMessageIndex,
    );
  },
  "session.forkFrom": async (ctx, payload) => {
    const parsed = CommandSchemas["session.forkFrom"].request.parse(payload);
    const { record, editorText } = await ctx.sessionManager.forkFrom(
      parsed.sessionId,
      parsed.entryId,
    );
    await ctx.metadataStore.appendSessionId(record.projectId, record.id);
    return { session: toSummary(record), editorText };
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
  "session.setAgentMode": async (ctx, payload) => {
    const parsed = CommandSchemas["session.setAgentMode"].request.parse(payload);
    await ctx.sessionManager.setAgentMode(parsed.sessionId, parsed.mode);
    return { ok: true as const };
  },
  "session.setExcludedTools": async (ctx, payload) => {
    const parsed = CommandSchemas["session.setExcludedTools"].request.parse(payload);
    await ctx.sessionManager.setExcludedTools(parsed.sessionId, parsed.excludedTools);
    return { ok: true as const };
  },
  "session.approvePlan": async (ctx, payload) => {
    const parsed = CommandSchemas["session.approvePlan"].request.parse(payload);
    const result = await ctx.sessionManager.approvePlan(
      parsed.sessionId,
      parsed.targetMode,
      parsed.continuationText,
    );
    return { ok: true as const, promptId: result.promptId };
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
  "session.answerQuestion": async (ctx, payload) => {
    const parsed = CommandSchemas["session.answerQuestion"].request.parse(payload);
    await ctx.sessionManager.answerQuestion(parsed.sessionId, parsed.askId, parsed.answer);
    return { ok: true as const };
  },
  "plan.file.read": async (ctx, payload) => {
    const parsed = CommandSchemas["plan.file.read"].request.parse(payload);
    const record = ctx.sessionManager.get(parsed.sessionId);
    if (!record) throw new RouterError("not_found", `Session ${parsed.sessionId} not found`);
    const absPath = PlanFileWatcher.planFilePath(record.projectPath, parsed.sessionId);
    const content = await PlanFileWatcher.readPlanFile(absPath);
    // Start (or refresh) the watcher so subsequent edits stream to the renderer. Idempotent.
    ctx.planFileWatcher.ensure(parsed.sessionId, record.projectPath);
    // Re-derive POSIX path so the response shape matches `plan.file.changed` events.
    const posixPath = absPath.split(/[\\/]/).join("/");
    return { path: posixPath, content };
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
  "git.fileBaseline": async (ctx, payload) => {
    const parsed = CommandSchemas["git.fileBaseline"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const content = await fileAtHead(project.path, parsed.path);
      return { content };
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
  "review.list": async (ctx, payload) => {
    const parsed = CommandSchemas["review.list"].request.parse(payload);
    return { turns: ctx.reviewStore.listFor(parsed.sessionId) };
  },
  "review.accept": async (ctx, payload) => {
    const parsed = CommandSchemas["review.accept"].request.parse(payload);
    await ctx.reviewStore.accept(parsed.sessionId, parsed.turnId);
    return { ok: true as const };
  },
  "review.reject": async (ctx, payload) => {
    const parsed = CommandSchemas["review.reject"].request.parse(payload);
    try {
      await ctx.reviewStore.reject(parsed.sessionId, parsed.turnId);
    } catch (err) {
      mapGitError(err);
    }
    return { ok: true as const };
  },
  "review.acceptFile": async (ctx, payload) => {
    const parsed = CommandSchemas["review.acceptFile"].request.parse(payload);
    await ctx.reviewStore.acceptFile(parsed.sessionId, parsed.turnId, parsed.path);
    return { ok: true as const };
  },
  "review.rejectFile": async (ctx, payload) => {
    const parsed = CommandSchemas["review.rejectFile"].request.parse(payload);
    try {
      await ctx.reviewStore.rejectFile(parsed.sessionId, parsed.turnId, parsed.path);
    } catch (err) {
      mapGitError(err);
    }
    return { ok: true as const };
  },
  "diff.get": async (ctx, payload) => {
    const parsed = CommandSchemas["diff.get"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const result = await diffForPath(project.path, parsed.path, parsed.baseline);
      return result;
    } catch (err) {
      mapGitError(err);
    }
  },
  "session.artefacts.list": async (ctx, payload) => {
    const parsed = CommandSchemas["session.artefacts.list"].request.parse(payload);
    return { artefacts: ctx.artefactsTracker.list(parsed.sessionId) };
  },
  "theme.list": async (ctx) => ({
    activeName: ctx.themeManager.getActiveName(),
    themes: ctx.themeManager.list(),
  }),
  "theme.get": async (ctx, payload) => {
    const parsed = CommandSchemas["theme.get"].request.parse(payload);
    const theme = ctx.themeManager.get(parsed.name);
    if (!theme) throw new RouterError("not_found", `Unknown theme: ${parsed.name}`);
    const vscodeRaw = ctx.themeManager.getVSCodeRaw(parsed.name);
    return vscodeRaw !== undefined ? { theme, vscodeRaw } : { theme };
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
  "theme.delete": async (ctx, payload) => {
    const parsed = CommandSchemas["theme.delete"].request.parse(payload);
    try {
      await ctx.themeManager.deleteUserTheme(parsed.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.startsWith("Cannot delete bundled theme")) {
        throw new RouterError("forbidden", message);
      }
      if (message.startsWith("Unknown theme")) {
        throw new RouterError("not_found", message);
      }
      throw err;
    }
    return { ok: true as const };
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
  "fs.tree": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.tree"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const snapshot = await ctx.fsWatchManager.getOrLoad(parsed.projectId);
      return snapshot;
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.createFile": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.createFile"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const path = await fsCreateFile({
        projectRoot: project.path,
        parentDir: parsed.parentDir,
        name: parsed.name,
      });
      return { path };
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.createFolder": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.createFolder"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const path = await fsCreateFolder({
        projectRoot: project.path,
        parentDir: parsed.parentDir,
        name: parsed.name,
      });
      return { path };
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.rename": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.rename"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const path = await fsRename({
        projectRoot: project.path,
        fromPath: parsed.fromPath,
        toName: parsed.toName,
      });
      return { path };
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.move": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.move"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      const path = await fsMove({
        projectRoot: project.path,
        fromPath: parsed.fromPath,
        toDir: parsed.toDir,
      });
      return { path };
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.delete": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.delete"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await fsTrashPaths({ projectRoot: project.path, paths: parsed.paths });
      return { ok: true as const };
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.readFile": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.readFile"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      return await fsReadTextFile({
        projectRoot: project.path,
        path: parsed.path,
        encoding: parsed.encoding,
      });
    } catch (err) {
      mapFsError(err);
    }
  },
  "fs.writeFile": async (ctx, payload) => {
    const parsed = CommandSchemas["fs.writeFile"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      await fsWriteTextFile({
        projectRoot: project.path,
        path: parsed.path,
        content: parsed.content,
        eol: parsed.eol,
        encoding: parsed.encoding,
        bom: parsed.bom,
      });
      return { ok: true as const };
    } catch (err) {
      mapFsError(err);
    }
  },
  "terminal.open": async (ctx, payload) => {
    const parsed = CommandSchemas["terminal.open"].request.parse(payload);
    try {
      return await ctx.terminalManager.open(parsed);
    } catch (err) {
      throw new RouterError(
        "terminal_open_failed",
        err instanceof Error ? err.message : String(err),
      );
    }
  },
  "terminal.write": async (ctx, payload) => {
    const parsed = CommandSchemas["terminal.write"].request.parse(payload);
    ctx.terminalManager.write(
      parsed.terminalId,
      Buffer.from(parsed.dataB64, "base64").toString("utf8"),
    );
    return { ok: true as const };
  },
  "terminal.resize": async (ctx, payload) => {
    const parsed = CommandSchemas["terminal.resize"].request.parse(payload);
    ctx.terminalManager.resize(parsed.terminalId, parsed.cols, parsed.rows);
    return { ok: true as const };
  },
  "terminal.close": async (ctx, payload) => {
    const parsed = CommandSchemas["terminal.close"].request.parse(payload);
    ctx.terminalManager.close(parsed.terminalId);
    return { ok: true as const };
  },
  "terminal.list": async (ctx) => ({ terminals: ctx.terminalManager.list() }),
  "terminal.snapshot": async (ctx, payload) => {
    const parsed = CommandSchemas["terminal.snapshot"].request.parse(payload);
    return { dataB64: ctx.terminalManager.snapshot(parsed.terminalId) };
  },
  "terminal.detectShells": async (ctx) => ctx.terminalManager.detectShells(),
  "lsp.status": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.status"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    return ctx.languageServerManager.status({
      projectId: project.id,
      projectRoot: project.path,
      refresh: parsed.refresh,
    });
  },
  "lsp.ensure": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.ensure"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    try {
      return await ctx.languageServerManager.ensure({
        projectId: project.id,
        projectRoot: project.path,
        languageId: parsed.languageId,
      });
    } catch (err) {
      mapLspError(err);
    }
  },
  "lsp.request": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.request"].request.parse(payload);
    try {
      return await ctx.languageServerManager.request(parsed);
    } catch (err) {
      mapLspError(err);
    }
  },
  "lsp.notify": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.notify"].request.parse(payload);
    try {
      ctx.languageServerManager.notify(parsed);
    } catch (err) {
      mapLspError(err);
    }
    return { ok: true as const };
  },
  "lsp.shutdown": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.shutdown"].request.parse(payload);
    await ctx.languageServerManager.shutdown(parsed.key);
    return { ok: true as const };
  },
  "lsp.customServers.list": async (ctx) => ({ servers: ctx.customLspServersStore.list() }),
  "lsp.customServers.upsert": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.customServers.upsert"].request.parse(payload);
    let servers: Awaited<ReturnType<CustomLspServersStore["upsert"]>>;
    try {
      servers = await ctx.customLspServersStore.upsert(parsed.server);
    } catch (err) {
      throw new RouterError("invalid_request", (err as Error).message);
    }
    ctx.languageServerManager.setCustomServers(ctx.customLspServersStore.toDefs());
    return { servers };
  },
  "lsp.customServers.delete": async (ctx, payload) => {
    const parsed = CommandSchemas["lsp.customServers.delete"].request.parse(payload);
    const servers = await ctx.customLspServersStore.delete(parsed.id);
    ctx.languageServerManager.setCustomServers(ctx.customLspServersStore.toDefs());
    return { servers };
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
