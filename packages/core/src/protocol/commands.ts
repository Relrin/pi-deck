import { z } from "zod";
import { ProjectSchema, ProjectSummarySchema } from "../domain/project.js";
import {
  SessionModelRefSchema,
  SessionSummarySchema,
  ThinkingLevelSchema,
} from "../domain/session.js";
import {
  CustomProviderInputSchema,
  ModelInfoSchema,
  ProviderSummarySchema,
} from "../providers/types.js";
import { themeListingSchema } from "./theme.js";

export const PingRequest = z.object({}).strict();
export const PingResponse = z.object({
  pong: z.literal(true),
  hostVersion: z.string(),
  protocolVersion: z.number().int(),
});

export const ProjectListRequest = z.object({}).strict();
export const ProjectListResponse = z.object({ projects: z.array(ProjectSummarySchema) });

export const ProjectOpenRequest = z.object({ path: z.string().min(1) });
export const ProjectOpenResponse = z.object({ project: ProjectSchema });

export const SessionListRequest = z.object({ projectId: z.string().uuid() });
export const SessionListResponse = z.object({ sessions: z.array(SessionSummarySchema) });

export const SessionCreateRequest = z.object({
  projectId: z.string().uuid(),
  title: z.string().optional(),
  modelRef: SessionModelRefSchema.optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
});
export const SessionCreateResponse = z.object({ session: SessionSummarySchema });

export const SessionActivateRequest = z.object({ sessionId: z.string().min(1) });
export const SessionActivateResponse = z.object({ ok: z.literal(true) });

export const SessionDeactivateRequest = z.object({ sessionId: z.string().min(1) });
export const SessionDeactivateResponse = z.object({ ok: z.literal(true) });

export const SessionPromptRequest = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
});
export const SessionPromptResponse = z.object({
  accepted: z.literal(true),
  /** Echoed back so the renderer can correlate a user message with the resulting events. */
  promptId: z.string(),
});

export const SessionCancelRequest = z.object({ sessionId: z.string().min(1) });
export const SessionCancelResponse = z.object({ ok: z.literal(true) });

export const SessionSetModelRequest = z.object({
  sessionId: z.string().min(1),
  modelRef: SessionModelRefSchema,
  thinkingLevel: ThinkingLevelSchema.optional(),
});
export const SessionSetModelResponse = z.object({ ok: z.literal(true) });

export const SessionSetThinkingLevelRequest = z.object({
  sessionId: z.string().min(1),
  level: ThinkingLevelSchema,
});
export const SessionSetThinkingLevelResponse = z.object({ ok: z.literal(true) });

export const GitBranchInfoSchema = z.object({
  name: z.string().min(1),
  isCurrent: z.boolean(),
  lastActivityAt: z.string().optional(),
});

export const GitListBranchesRequest = z.object({ projectId: z.string().uuid() });
export const GitListBranchesResponse = z.object({
  branches: z.array(GitBranchInfoSchema),
});

export const GitCurrentBranchRequest = z.object({ projectId: z.string().uuid() });
export const GitCurrentBranchResponse = z.object({ name: z.string() });

export const GitCheckoutBranchRequest = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
});
export const GitCheckoutBranchResponse = z.object({ ok: z.literal(true) });

export const ThemeListRequest = z.object({}).strict();
export const ThemeListResponse = z.object({
  activeName: z.string(),
  themes: z.array(themeListingSchema),
});

export const ThemeGetRequest = z.object({ name: z.string().min(1) });
/** The theme payload is round-tripped as-is; the renderer revalidates via `themeSpecSchema`. */
export const ThemeGetResponse = z.object({ theme: z.unknown() });

export const ThemeSetActiveRequest = z.object({ name: z.string().min(1) });
export const ThemeSetActiveResponse = z.object({ ok: z.literal(true) });

export const ThemeImportRequest = z.object({ sourcePath: z.string().min(1) });
export const ThemeImportResponse = z.object({ name: z.string() });

export const ProviderListRequest = z.object({}).strict();
export const ProviderListResponse = z.object({
  providers: z.array(ProviderSummarySchema),
  defaultModel: SessionModelRefSchema.optional(),
});

export const ProviderModelsRequest = z.object({ providerId: z.string().min(1) });
export const ProviderModelsResponse = z.object({
  providerId: z.string().min(1),
  models: z.array(ModelInfoSchema),
});

export const ProviderAddCustomRequest = z.object({ def: CustomProviderInputSchema });
export const ProviderAddCustomResponse = z.object({
  id: z.string().min(1),
  provider: ProviderSummarySchema,
});

export const ProviderRemoveCustomRequest = z.object({ id: z.string().min(1) });
export const ProviderRemoveCustomResponse = z.object({ ok: z.literal(true) });

export const ProviderSetApiKeyRequest = z.object({
  authJsonKey: z.string().min(1),
  /** Renderer ↔ host only; the host never forwards this to the renderer or worker stdio. */
  secret: z.string().min(1),
});
export const ProviderSetApiKeyResponse = z.object({ ok: z.literal(true) });

export const ProviderClearApiKeyRequest = z.object({ authJsonKey: z.string().min(1) });
export const ProviderClearApiKeyResponse = z.object({ ok: z.literal(true) });

export const CommandSchemas = {
  ping: { request: PingRequest, response: PingResponse },
  "project.list": { request: ProjectListRequest, response: ProjectListResponse },
  "project.open": { request: ProjectOpenRequest, response: ProjectOpenResponse },
  "session.list": { request: SessionListRequest, response: SessionListResponse },
  "session.create": { request: SessionCreateRequest, response: SessionCreateResponse },
  "session.activate": { request: SessionActivateRequest, response: SessionActivateResponse },
  "session.deactivate": { request: SessionDeactivateRequest, response: SessionDeactivateResponse },
  "session.prompt": { request: SessionPromptRequest, response: SessionPromptResponse },
  "session.cancel": { request: SessionCancelRequest, response: SessionCancelResponse },
  "session.setModel": { request: SessionSetModelRequest, response: SessionSetModelResponse },
  "session.setThinkingLevel": {
    request: SessionSetThinkingLevelRequest,
    response: SessionSetThinkingLevelResponse,
  },
  "git.listBranches": {
    request: GitListBranchesRequest,
    response: GitListBranchesResponse,
  },
  "git.currentBranch": {
    request: GitCurrentBranchRequest,
    response: GitCurrentBranchResponse,
  },
  "git.checkoutBranch": {
    request: GitCheckoutBranchRequest,
    response: GitCheckoutBranchResponse,
  },
  "theme.list": { request: ThemeListRequest, response: ThemeListResponse },
  "theme.get": { request: ThemeGetRequest, response: ThemeGetResponse },
  "theme.setActive": { request: ThemeSetActiveRequest, response: ThemeSetActiveResponse },
  "theme.import": { request: ThemeImportRequest, response: ThemeImportResponse },
  "provider.list": { request: ProviderListRequest, response: ProviderListResponse },
  "provider.models": { request: ProviderModelsRequest, response: ProviderModelsResponse },
  "provider.addCustom": { request: ProviderAddCustomRequest, response: ProviderAddCustomResponse },
  "provider.removeCustom": {
    request: ProviderRemoveCustomRequest,
    response: ProviderRemoveCustomResponse,
  },
  "provider.setApiKey": {
    request: ProviderSetApiKeyRequest,
    response: ProviderSetApiKeyResponse,
  },
  "provider.clearApiKey": {
    request: ProviderClearApiKeyRequest,
    response: ProviderClearApiKeyResponse,
  },
} as const;

export type CommandName = keyof typeof CommandSchemas;

export const CommandNameSchema = z.enum(
  Object.keys(CommandSchemas) as [CommandName, ...CommandName[]],
);

export type CommandRequest<C extends CommandName> = z.infer<(typeof CommandSchemas)[C]["request"]>;
export type CommandResponse<C extends CommandName> = z.infer<
  (typeof CommandSchemas)[C]["response"]
>;
