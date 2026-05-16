import { type CommandName, CommandSchemas } from "../protocol/commands.js";
import type { MetadataStore } from "./metadata-store.js";
import type { SessionManager } from "./session-manager.js";
import type { ThemeManager } from "./themes/index.js";

export interface RouterContext {
  metadataStore: MetadataStore;
  sessionManager: SessionManager;
  themeManager: ThemeManager;
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
    const records = ctx.sessionManager.list(parsed.projectId);
    return {
      sessions: records.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        title: r.title,
        lastActivityAt: r.lastActivityAt,
      })),
    };
  },
  "session.create": async (ctx, payload) => {
    const parsed = CommandSchemas["session.create"].request.parse(payload);
    const project = await ctx.metadataStore.readProject(parsed.projectId);
    if (!project) throw new RouterError("not_found", `Project ${parsed.projectId} not found`);
    const record = await ctx.sessionManager.create({
      projectId: project.id,
      projectPath: project.path,
      title: parsed.title,
    });
    await ctx.metadataStore.appendSessionId(project.id, record.id);
    return {
      session: {
        id: record.id,
        projectId: record.projectId,
        title: record.title,
        lastActivityAt: record.lastActivityAt,
      },
    };
  },
  "session.activate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.activate"].request.parse(payload);
    await ctx.sessionManager.activate(parsed.sessionId);
    return { ok: true as const };
  },
  "session.deactivate": async (ctx, payload) => {
    const parsed = CommandSchemas["session.deactivate"].request.parse(payload);
    await ctx.sessionManager.deactivate(parsed.sessionId);
    return { ok: true as const };
  },
  "session.prompt": async (ctx, payload) => {
    const parsed = CommandSchemas["session.prompt"].request.parse(payload);
    const result = await ctx.sessionManager.prompt(parsed.sessionId, parsed.text);
    return { accepted: true as const, promptId: result.promptId };
  },
  "session.cancel": async (ctx, payload) => {
    const parsed = CommandSchemas["session.cancel"].request.parse(payload);
    await ctx.sessionManager.cancel(parsed.sessionId);
    return { ok: true as const };
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
