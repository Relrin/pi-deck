import { z } from "zod";
import { ProjectSchema, ProjectSummarySchema } from "../domain/project.js";
import {
  AgentModeSchema,
  SessionModelRefSchema,
  SessionSummarySchema,
  ThinkingLevelSchema,
} from "../domain/session.js";
import { FsNodeSchema } from "../fs/types.js";
import {
  GitBranchInfoSchema,
  GitCommitSchema,
  GitHunkSchema,
  GitStatusSchema,
} from "../git/types.js";
import {
  CustomProviderInputSchema,
  ModelInfoSchema,
  ProviderSummarySchema,
} from "../providers/types.js";
import {
  LspCustomServersDeleteRequest,
  LspCustomServersDeleteResponse,
  LspCustomServersListRequest,
  LspCustomServersListResponse,
  LspCustomServersUpsertRequest,
  LspCustomServersUpsertResponse,
  LspEnsureRequest,
  LspEnsureResponse,
  LspNotifyRequest,
  LspNotifyResponse,
  LspRequestRequest,
  LspRequestResponse,
  LspShutdownRequest,
  LspShutdownResponse,
  LspStatusRequest,
  LspStatusResponse,
} from "./lsp.js";
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

export const ProjectFileEntrySchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["file"]),
});
export const ProjectListFilesRequest = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().max(20000).optional(),
});
export const ProjectListFilesResponse = z.object({
  entries: z.array(ProjectFileEntrySchema),
});

export const PromptAttachmentSchema = z.object({
  kind: z.enum(["file", "folder", "repo-ref"]),
  path: z.string().min(1),
});
export type PromptAttachment = z.infer<typeof PromptAttachmentSchema>;

/**
 * Binary image attached to a prompt (e.g. a clipboard-pasted screenshot). Carried inline
 * as base64 so the worker can hand it straight to pi's `session.prompt(text, { images })`
 * without touching disk. Kept separate from `PromptAttachment` because the path-based
 * attachments and binary blobs have nothing in common beyond "user attached this".
 */
export const PromptImageSchema = z.object({
  /** MIME type accepted by pi's `ImageContent`. */
  mimeType: z.string().regex(/^image\/(png|jpeg|jpg|webp|gif)$/),
  /** Base64-encoded payload, NO `data:…;base64,` prefix. */
  data: z.string().min(1),
  /** Display name (e.g. "Pasted image" or original filename). */
  name: z.string().optional(),
});
export type PromptImage = z.infer<typeof PromptImageSchema>;

export const SessionListRequest = z.object({ projectId: z.string().uuid() });
export const SessionListResponse = z.object({ sessions: z.array(SessionSummarySchema) });

export const SessionCreateRequest = z.object({
  projectId: z.string().uuid(),
  title: z.string().optional(),
  modelRef: SessionModelRefSchema.optional(),
  thinkingLevel: ThinkingLevelSchema.optional(),
  agentMode: AgentModeSchema.optional(),
  /** Tool ids to disable for this session. See SessionSummarySchema.excludedTools. */
  excludedTools: z.array(z.string().min(1)).optional(),
});
export const SessionCreateResponse = z.object({ session: SessionSummarySchema });

export const SessionActivateRequest = z.object({ sessionId: z.string().min(1) });
export const SessionActivateResponse = z.object({ ok: z.literal(true) });

export const SessionDeactivateRequest = z.object({ sessionId: z.string().min(1) });
export const SessionDeactivateResponse = z.object({ ok: z.literal(true) });

export const SessionPromptRequest = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
  /** Composer agent mode for this turn; also rewrites the session's persisted mode. */
  agentMode: AgentModeSchema.optional(),
  /** Files / folders / repo refs the user attached to this turn. */
  attachments: z.array(PromptAttachmentSchema).optional(),
  /** Inline images (e.g. clipboard pastes) the user attached to this turn. */
  images: z.array(PromptImageSchema).optional(),
});
export const SessionPromptResponse = z.object({
  accepted: z.literal(true),
  /** Echoed back so the renderer can correlate a user message with the resulting events. */
  promptId: z.string(),
});

export const SessionCancelRequest = z.object({ sessionId: z.string().min(1) });
export const SessionCancelResponse = z.object({ ok: z.literal(true) });

/** Hard-stop: kill the session's worker process tree without waiting for a graceful abort. */
export const SessionForceStopRequest = z.object({ sessionId: z.string().min(1) });
export const SessionForceStopResponse = z.object({ ok: z.literal(true) });

/**
 * One slash-command the session's agent understands: extension commands, prompt templates,
 * and skills (already `skill:`-prefixed by pi). The composer's `/` autocomplete renders these;
 * pi expands them inside `session.prompt()` — no client-side processing.
 */
export const SessionCommandInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  source: z.enum(["extension", "prompt", "skill"]),
  /** Where the command came from (skill file, template file, extension path), for tooltips. */
  sourcePath: z.string().optional(),
});
export type SessionCommandInfo = z.infer<typeof SessionCommandInfoSchema>;

export const SessionCommandsRequest = z.object({ sessionId: z.string().min(1) });
export const SessionCommandsResponse = z.object({
  commands: z.array(SessionCommandInfoSchema),
});

/**
 * Disk-derived command list for composers without a live session (the BLANK screen):
 * prompt templates + skills only — extension commands need a running agent.
 */
export const ProjectCommandsRequest = z.object({ projectId: z.string().uuid() });
export const ProjectCommandsResponse = z.object({
  commands: z.array(SessionCommandInfoSchema),
});

/** A skill discovered on disk (host-side scan; no live session needed). */
export const SkillInfoSchema = z.object({
  name: z.string(),
  description: z.string(),
  filePath: z.string(),
  baseDir: z.string(),
  scope: z.enum(["user", "project", "temporary"]),
  /** Hidden from the system prompt; only invocable via /skill:name. */
  disableModelInvocation: z.boolean(),
  /** True when the skill lives in a directory pi-deck is allowed to delete from. */
  removable: z.boolean(),
});
export type SkillInfo = z.infer<typeof SkillInfoSchema>;

export const SkillDiagnosticSchema = z.object({
  type: z.enum(["warning", "error", "collision"]),
  message: z.string(),
  path: z.string().optional(),
});

export const SkillsListRequest = z.object({ projectId: z.string().uuid() });
export const SkillsListResponse = z.object({
  skills: z.array(SkillInfoSchema),
  diagnostics: z.array(SkillDiagnosticSchema),
});

/** One skill discovered inside a freshly-cloned repo during `skills.scan`. */
export const ScannedSkillSchema = z.object({
  /** Stable key for this scan (skill name, de-duplicated). Echoed back in `skills.install`. */
  id: z.string(),
  name: z.string(),
  description: z.string(),
  /** True when a global skill of the same name is already installed. */
  alreadyInstalled: z.boolean(),
});
export type ScannedSkill = z.infer<typeof ScannedSkillSchema>;

export const SkillsScanRequest = z.object({ url: z.string().min(1) });
export const SkillsScanResponse = z.object({
  /** Opaque handle the renderer passes to `skills.install` to install a chosen subset. */
  scanId: z.string().min(1),
  repo: z.object({
    slug: z.string(),
    branch: z.string(),
    commit: z.string(),
  }),
  skills: z.array(ScannedSkillSchema),
});

export const SkillsInstallRequest = z.object({
  source: z.discriminatedUnion("kind", [
    /** Install a chosen subset from a prior `skills.scan` (by scan handle + skill ids). */
    z.object({
      kind: z.literal("scan"),
      scanId: z.string().min(1),
      skillIds: z.array(z.string().min(1)).min(1),
    }),
    /** Copy a local folder containing a SKILL.md (or .md files) into the global skills dir. */
    z.object({ kind: z.literal("folder"), path: z.string().min(1) }),
  ]),
});
export const SkillsInstallResponse = z.object({
  installed: z.array(z.object({ name: z.string() })),
  /** Names of selected skills skipped because they were already installed. */
  skipped: z.array(z.string()),
});

export const SkillsUninstallRequest = z.object({
  projectId: z.string().uuid(),
  filePath: z.string().min(1),
  baseDir: z.string().min(1),
});
export const SkillsUninstallResponse = z.object({ ok: z.literal(true) });

/**
 * MCP servers. pi-deck keeps its own catalog of installed servers (a JSON file in the host's
 * userData dir, never read by the adapter); a project's `.pi/mcp.json` is the authoritative
 * enabled set the pi-mcp-adapter reads. A catalog spec carries the adapter-recognized config
 * fields plus display-only metadata — only the adapter-recognized subset is written into
 * `.pi/mcp.json`.
 */
export const McpTransportSchema = z.enum(["stdio", "http"]);
export const McpLifecycleSchema = z.enum(["lazy", "eager", "keep-alive"]);

export const McpServerSpecSchema = z.object({
  /** Stable key used under `mcpServers` in mcp.json. */
  name: z.string().min(1),
  transport: McpTransportSchema,
  /** stdio transport. */
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  /** http transport. */
  url: z.string().min(1).optional(),
  env: z.record(z.string(), z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  /** Only set when the registry/source advertises auth. */
  auth: z.enum(["bearer", "oauth"]).optional(),
  lifecycle: McpLifecycleSchema.default("lazy"),
  idleTimeout: z.number().int().positive().optional(),
  /** Display-only catalog fields — never written into mcp.json. */
  description: z.string().optional(),
  publisher: z.string().optional(),
  packageId: z.string().optional(),
});
export type McpServerSpec = z.infer<typeof McpServerSpecSchema>;

export const McpServerInfoSchema = McpServerSpecSchema.extend({
  /** True when the server is present in the active project's `.pi/mcp.json`. */
  enabledInProject: z.boolean(),
  /** Where the server is known from: pi-deck catalog, the project file, or both. */
  source: z.enum(["catalog", "project", "both"]),
});
export type McpServerInfo = z.infer<typeof McpServerInfoSchema>;

/** A normalized registry result, with a ready-to-install spec derived host-side. */
export const RegistryServerSchema = z.object({
  /** Registry reverse-DNS name (stable list key). */
  id: z.string(),
  /** Friendly display name. */
  name: z.string(),
  description: z.string(),
  publisher: z.string(),
  transport: McpTransportSchema,
  packageId: z.string(),
  spec: McpServerSpecSchema,
});
export type RegistryServer = z.infer<typeof RegistryServerSchema>;

export const McpAdapterStatusSchema = z.object({
  installed: z.boolean(),
  version: z.string().nullable(),
});

export const McpListRequest = z.object({ projectId: z.string().uuid() });
export const McpListResponse = z.object({
  servers: z.array(McpServerInfoSchema),
  adapter: McpAdapterStatusSchema,
});

export const McpRegistrySearchRequest = z.object({
  /** Name substring (the official registry only supports name search). */
  query: z.string().optional(),
  /** Opaque pagination cursor from a prior response. */
  cursor: z.string().optional(),
});
export const McpRegistrySearchResponse = z.object({
  servers: z.array(RegistryServerSchema),
  nextCursor: z.string().optional(),
});

export const McpInstallRequest = z.object({
  projectId: z.string().uuid(),
  spec: McpServerSpecSchema,
});
export const McpInstallResponse = z.object({ ok: z.literal(true), name: z.string() });

export const McpSetProjectEnabledRequest = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  enabled: z.boolean(),
});
export const McpSetProjectEnabledResponse = z.object({ ok: z.literal(true) });

export const McpUninstallRequest = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
});
export const McpUninstallResponse = z.object({ ok: z.literal(true) });

export const SessionArchiveRequest = z.object({ sessionId: z.string().min(1) });
export const SessionArchiveResponse = z.object({ ok: z.literal(true) });

export const SessionUnarchiveRequest = z.object({ sessionId: z.string().min(1) });
export const SessionUnarchiveResponse = z.object({ ok: z.literal(true) });

export const SessionDeleteRequest = z.object({ sessionId: z.string().min(1) });
export const SessionDeleteResponse = z.object({ ok: z.literal(true) });

export const SessionRenameRequest = z.object({
  sessionId: z.string().min(1),
  title: z.string().min(1).max(200),
});
export const SessionRenameResponse = z.object({ ok: z.literal(true) });

/** Returns archived sessions across every project so the rail's ARCHIVE group can render
 * without waiting for each project block to be expanded. */
export const SessionListArchivedRequest = z.object({}).strict();
export const SessionListArchivedResponse = z.object({
  sessions: z.array(SessionSummarySchema),
});

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

/**
 * Renderer → host: set the session's permission mode without sending a prompt. Used by the
 * composer's mode picker so flipping plan/ask/accept-edits has real consequences even when
 * no turn is in flight. The host persists the new mode and forwards to the live worker.
 */
export const SessionSetAgentModeRequest = z.object({
  sessionId: z.string().min(1),
  mode: AgentModeSchema,
});
export const SessionSetAgentModeResponse = z.object({ ok: z.literal(true) });

/**
 * Renderer → host: replace the session's disabled-tools list. pi 0.77's SDK only honours
 * `excludeTools` at `createAgentSession` time, so the host respawns the worker when the live
 * value changes.
 */
export const SessionSetExcludedToolsRequest = z.object({
  sessionId: z.string().min(1),
  excludedTools: z.array(z.string().min(1)),
});
export const SessionSetExcludedToolsResponse = z.object({ ok: z.literal(true) });

/**
 * Renderer → host: approve the current plan and transition into an executing mode. The host
 * flips the session's mode to `targetMode`, then immediately issues a continuation prompt so
 * the agent starts executing the plan. The continuation message becomes a normal user turn in
 * the transcript — no hidden state.
 */
export const SessionApprovePlanRequest = z.object({
  sessionId: z.string().min(1),
  /** Mode the session transitions to after approval — typically what the user had selected
   * before they entered plan mode, or their preferred posture for execution. */
  targetMode: z.enum(["ask", "accept-edits"]),
  /** Optional override for the continuation prompt text. */
  continuationText: z.string().min(1).optional(),
});
export const SessionApprovePlanResponse = z.object({
  ok: z.literal(true),
  /** Echoed back so the renderer can correlate the auto-sent continuation with its events. */
  promptId: z.string(),
});

/** Renderer → host call resolving a `session.tool.approval.requested` event. */
export const SessionToolApprovalRequest = z.object({
  sessionId: z.string().min(1),
  approvalId: z.string().min(1),
  decision: z.enum(["allow", "deny"]),
  reason: z.string().optional(),
});
export const SessionToolApprovalResponse = z.object({ ok: z.literal(true) });

/**
 * Renderer → host: read the current content of a session's plan file. Used by `PlanPanel`
 * on first mount (or when the user reopens it after a restart) before the `plan.file.changed`
 * stream catches up. The host also lazily starts the file watcher when this is first called,
 * so the panel begins receiving live updates immediately afterward.
 */
export const PlanFileReadRequest = z.object({ sessionId: z.string().min(1) });
export const PlanFileReadResponse = z.object({
  path: z.string().min(1),
  /** Markdown content, or `null` when the file does not exist yet. */
  content: z.string().nullable(),
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

export const GitCreateBranchRequest = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
});
export const GitCreateBranchResponse = z.object({ ok: z.literal(true) });

export const GitStatusRequest = z.object({ projectId: z.string().uuid() });
export const GitStatusResponse = z.object({ status: GitStatusSchema });

export const GitLogRequest = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().max(200).optional(),
});
export const GitLogResponse = z.object({ commits: z.array(GitCommitSchema) });

export const GitDiffHunksRequest = z.object({ projectId: z.string().uuid() });
export const GitDiffHunksResponse = z.object({
  /** Hunks per file, keyed by repo-relative path. Absent entries mean "no hunks" — most
   * commonly untracked files, which don't show up in `git diff HEAD`. */
  hunksByPath: z.record(z.string(), z.array(GitHunkSchema)),
});

/**
 * Read a file's contents as of HEAD — the editor's diff baseline for live add/mod/del gutter
 * tints. `path` is repo-relative (forward slashes). `content` is `null` when the file is
 * untracked / absent at HEAD (the editor then renders the whole buffer as added) or when the
 * project isn't a git repo.
 */
export const GitFileBaselineRequest = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1),
});
export const GitFileBaselineResponse = z.object({
  content: z.string().nullable(),
});

export const GitCommitRequest = z.object({
  projectId: z.string().uuid(),
  message: z.string().min(1),
  amend: z.boolean().optional(),
  /** Paths to stage immediately before committing. Empty / omitted = commit whatever's
   * already staged. */
  paths: z.array(z.string().min(1)).optional(),
});
export const GitCommitResponse = z.object({
  sha: z.string().min(7),
  shortSha: z.string().min(4),
  subject: z.string(),
});

const PushFailureReason = z.enum([
  "non_fast_forward",
  "no_upstream",
  "auth_failed",
  "rejected",
  "unknown",
]);
export const GitPushRequest = z.object({
  projectId: z.string().uuid(),
  forceWithLease: z.boolean().optional(),
});
export const GitPushResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), stderr: z.string() }),
  z.object({ ok: z.literal(false), reason: PushFailureReason, stderr: z.string() }),
]);

const PullFailureReason = z.enum(["conflict", "no_upstream", "auth_failed", "unknown"]);
export const GitPullRequest = z.object({
  projectId: z.string().uuid(),
  rebase: z.boolean().optional(),
});
export const GitPullResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), stderr: z.string() }),
  z.object({ ok: z.literal(false), reason: PullFailureReason, stderr: z.string() }),
]);

export const GitResetSoftHeadParentRequest = z.object({ projectId: z.string().uuid() });
export const GitResetSoftHeadParentResponse = z.object({ ok: z.literal(true) });

export const GitOpenPrUrlRequest = z.object({
  projectId: z.string().uuid(),
  remote: z.string().min(1).optional(),
});
export const GitOpenPrUrlResponse = z.object({
  url: z.string().min(1),
  branch: z.string().min(1),
  remote: z.string().min(1),
});

export const GitCommitUrlRequest = z.object({
  projectId: z.string().uuid(),
  sha: z.string().min(7),
  remote: z.string().min(1).optional(),
});
export const GitCommitUrlResponse = z.object({ url: z.string().min(1) });

export const GitCheckoutPathsRequest = z.object({
  projectId: z.string().uuid(),
  /** Tracked paths to restore via `git checkout HEAD --`. */
  tracked: z.array(z.string().min(1)),
  /** Untracked paths to remove via `git clean -f --` (no HEAD entry to restore to). */
  untracked: z.array(z.string().min(1)),
});
export const GitCheckoutPathsResponse = z.object({ ok: z.literal(true) });

const StashFailureReason = z.enum(["no_changes", "unknown"]);
export const GitStashRequest = z.object({
  projectId: z.string().uuid(),
  message: z.string().optional(),
  paths: z.array(z.string().min(1)).optional(),
  includeUntracked: z.boolean().optional(),
});
export const GitStashResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), stderr: z.string() }),
  z.object({ ok: z.literal(false), reason: StashFailureReason, stderr: z.string() }),
]);

const StashPopFailureReason = z.enum(["empty_stack", "conflict", "unknown"]);
export const GitStashPopRequest = z.object({ projectId: z.string().uuid() });
export const GitStashPopResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), stderr: z.string() }),
  z.object({ ok: z.literal(false), reason: StashPopFailureReason, stderr: z.string() }),
]);

export const GitInitRequest = z.object({ projectId: z.string().uuid() });
export const GitInitResponse = z.object({ ok: z.literal(true) });

export const GitTurnTouchesRequest = z.object({ sessionId: z.string().min(1) });
export const GitTurnTouchesResponse = z.object({
  /** Absolute paths the current turn has written to since the last turn boundary. */
  paths: z.array(z.string()),
  /** Monotonic counter the renderer uses to invalidate stale snapshots. */
  turnSeq: z.number().int().nonnegative(),
});

/**
 * One reviewable file inside a `ReviewTurn`. `status` matches the canonical git short
 * status (`M` modified, `A` added by the agent, `D` deleted by the agent) and is computed
 * by the host against the turn-start baseline, not against HEAD.
 */
export const ReviewFileSchema = z.object({
  /** Repo-relative path (POSIX-normalised). */
  path: z.string().min(1),
  status: z.enum(["M", "A", "D"]),
});

/**
 * One turn's worth of agent-driven file changes pending user review. `stashSha` is the
 * `git stash create` SHA captured at turn start.
 */
export const ReviewTurnSchema = z.object({
  turnId: z.string().min(1),
  sessionId: z.string().min(1),
  /** Project the turn ran inside — needed for the renderer to look up the repo root and
   * route `diff.get` requests. */
  projectId: z.string().min(1),
  /** Turn-start `git stash create` SHA, or null when the tree was clean (baseline = HEAD). */
  stashSha: z.string().nullable(),
  files: z.array(ReviewFileSchema),
  /** Epoch ms when the turn ended and this record was finalised. */
  createdAt: z.number().int().nonnegative(),
});
export type ReviewTurn = z.infer<typeof ReviewTurnSchema>;

export const ReviewListRequest = z.object({ sessionId: z.string().min(1) });
export const ReviewListResponse = z.object({ turns: z.array(ReviewTurnSchema) });

export const ReviewAcceptRequest = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
});
export const ReviewAcceptResponse = z.object({ ok: z.literal(true) });

export const ReviewRejectRequest = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
});
export const ReviewRejectResponse = z.object({ ok: z.literal(true) });

export const ReviewAcceptFileRequest = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  path: z.string().min(1),
});
export const ReviewAcceptFileResponse = z.object({ ok: z.literal(true) });

export const ReviewRejectFileRequest = z.object({
  sessionId: z.string().min(1),
  turnId: z.string().min(1),
  path: z.string().min(1),
});
export const ReviewRejectFileResponse = z.object({ ok: z.literal(true) });

/**
 * Baseline the diff is computed against. `"HEAD"` is the ad-hoc viewer's case (git
 * sidebar click); `{ kind: "stash", sha }` is the review flow's case, where the SHA
 * comes from the `ReviewTurn` the renderer is rendering.
 */
export const DiffBaselineSchema = z.union([
  z.literal("HEAD"),
  z.object({ kind: z.literal("stash"), sha: z.string().min(1) }),
]);

export const DiffGetRequest = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1),
  baseline: DiffBaselineSchema,
});
export const DiffGetResponse = z.object({
  unified: z.string(),
  before: z.string().nullable(),
  after: z.string().nullable(),
  status: z.enum(["M", "A", "D"]),
});

/**
 * Snapshot fetch for the Context tab's "Artefacts produced" section. The renderer also
 * receives live updates via `session.artefacts.changed` events; this command is only used to
 * prime the store when the tab is opened mid-session.
 */
export const SessionArtefactsListRequest = z.object({ sessionId: z.string().min(1) });
export const SessionArtefactsListResponse = z.object({
  artefacts: z.array(
    z.object({
      path: z.string().min(1),
      sizeBytes: z.number().int().nonnegative(),
      createdAt: z.number().int().nonnegative(),
    }),
  ),
});

export const ThemeListRequest = z.object({}).strict();
export const ThemeListResponse = z.object({
  activeName: z.string(),
  themes: z.array(themeListingSchema),
});

export const ThemeGetRequest = z.object({ name: z.string().min(1) });
export const ThemeGetResponse = z.object({
  theme: z.unknown(),
  vscodeRaw: z.unknown().optional(),
});

export const ThemeSetActiveRequest = z.object({ name: z.string().min(1) });
export const ThemeSetActiveResponse = z.object({ ok: z.literal(true) });

export const ThemeImportRequest = z.object({ sourcePath: z.string().min(1) });
export const ThemeImportResponse = z.object({ name: z.string() });

export const ThemeDeleteRequest = z.object({ name: z.string().min(1) });
export const ThemeDeleteResponse = z.object({ ok: z.literal(true) });

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

/**
 * Filesystem tree walk for the files-tab sidebar. The host walks the project root once on
 * first request per project and incrementally maintains the cache via the fs watcher;
 * subsequent calls just return the cached snapshot.
 */
export const FsTreeRequest = z.object({ projectId: z.string().uuid() });
export const FsTreeResponse = z.object({
  /** Project root absolute path (POSIX-normalised) — useful for the renderer to render
   * a header label and for path-equality checks. */
  root: z.string().min(1),
  /** Top-level children of the project root. Directories carry their own children
   * recursively; files carry no `children` array. */
  nodes: z.array(FsNodeSchema),
});

/**
 * Create a new empty file at `parentDir/name`. `parentDir` must resolve inside the
 * project root or the host returns a `path_escape` RouterError.
 */
export const FsCreateFileRequest = z.object({
  projectId: z.string().uuid(),
  /** Absolute path of the directory that should host the new file. */
  parentDir: z.string().min(1),
  /** Basename of the new file. No path separators, null bytes, or reserved names. */
  name: z.string().min(1),
});
export const FsCreateFileResponse = z.object({
  /** Resolved absolute path (POSIX) of the newly-created file. */
  path: z.string().min(1),
});

export const FsCreateFolderRequest = z.object({
  projectId: z.string().uuid(),
  parentDir: z.string().min(1),
  name: z.string().min(1),
});
export const FsCreateFolderResponse = z.object({
  path: z.string().min(1),
});

export const FsRenameRequest = z.object({
  projectId: z.string().uuid(),
  /** Absolute path of the source file or folder. */
  fromPath: z.string().min(1),
  /** New basename (parent directory is preserved). */
  toName: z.string().min(1),
});
export const FsRenameResponse = z.object({
  path: z.string().min(1),
});

/**
 * Move a file or folder into a different directory, preserving its basename. Distinct from
 * `fs.rename` (which only changes the basename within the same parent) — this backs the file
 * tree's cross-directory drag-and-drop. Both paths must resolve inside the project root.
 */
export const FsMoveRequest = z.object({
  projectId: z.string().uuid(),
  /** Absolute path of the source file or folder. */
  fromPath: z.string().min(1),
  /** Absolute path of the destination directory the item moves into. */
  toDir: z.string().min(1),
});
export const FsMoveResponse = z.object({
  /** Resolved absolute path (POSIX) of the item at its new location. */
  path: z.string().min(1),
});

/**
 * Move the listed paths to the OS trash via Electron's `shell.trashItem`. The operation
 * is recoverable from the user's trash on every platform — but we still gate it on a
 * confirmation dialog on the renderer side.
 */
export const FsDeleteRequest = z.object({
  projectId: z.string().uuid(),
  paths: z.array(z.string().min(1)).min(1),
});
export const FsDeleteResponse = z.object({ ok: z.literal(true) });

/**
 * Read a project file for the code editor. The host guards binary blobs (NUL sniff) and very
 * large files: in those cases `content` is empty and `binary` / `tooLarge` is set so the editor
 * opens read-only with a notice. `content` is LF-normalised; `eol` reports the on-disk ending so
 * `fs.writeFile` can round-trip it.
 */
export const FsReadFileRequest = z.object({
  projectId: z.string().uuid(),
  /** Absolute path of the file to read; must resolve inside the project root. */
  path: z.string().min(1),
  /** Character encoding to decode the bytes with (iconv-lite name). Defaults to UTF-8. */
  encoding: z.string().optional(),
});
export const FsReadFileResponse = z.object({
  content: z.string(),
  eol: z.enum(["lf", "crlf"]),
  /** Encoding actually used to decode the file (echoes the request, or the UTF-8 default). */
  encoding: z.string(),
  binary: z.boolean(),
  tooLarge: z.boolean(),
  sizeBytes: z.number().int().nonnegative(),
});

/**
 * Persist editor content to a project file. `content` is LF-separated; the host re-applies
 * `eol` on write. `path` must resolve inside the project root.
 */
export const FsWriteFileRequest = z.object({
  projectId: z.string().uuid(),
  path: z.string().min(1),
  content: z.string(),
  eol: z.enum(["lf", "crlf"]),
  /** Character encoding to write the bytes as (iconv-lite name). Defaults to UTF-8. */
  encoding: z.string().optional(),
  /** Prepend a byte-order mark (for UTF-8/UTF-16). Ignored for encodings without a BOM. */
  bom: z.boolean().optional(),
});
export const FsWriteFileResponse = z.object({ ok: z.literal(true) });

/**
 * Coarse family of a detected shell, used by the renderer to pick an icon and (for WSL) to tell
 * apart entries that share the same `path`. The schema stores it as a free-form `string` so new
 * kinds never break response validation; the renderer treats unknown values as "other".
 */
export type TerminalShellKind =
  | "powershell"
  | "cmd"
  | "gitbash"
  | "wsl"
  | "bash"
  | "zsh"
  | "fish"
  | "sh"
  | "other";

export const TerminalShellSchema = z.object({
  /** Display label, e.g. "PowerShell", "zsh", "Git Bash", "Ubuntu (WSL)". */
  label: z.string().min(1),
  /** Absolute path (or bare command resolvable on PATH) used to spawn the PTY. */
  path: z.string().min(1),
  /** Default args passed at spawn (e.g. `["-i", "-l"]` for Git Bash, `["-d", "Ubuntu"]` for WSL). */
  args: z.array(z.string()),
  /** Shell family hint for icon mapping; absent on shells detected before this field existed. */
  kind: z.string().optional(),
});
export type TerminalShell = z.infer<typeof TerminalShellSchema>;

export const TerminalOpenRequest = z.object({
  /** Working directory for the new PTY. Must be an existing directory. */
  cwd: z.string().min(1),
  cols: z.number().int().positive().max(2000),
  rows: z.number().int().positive().max(2000),
  /** Absolute path / command to spawn; the host falls back to the OS default when omitted. */
  shell: z.string().min(1).optional(),
  /** Args for the shell; only honoured together with `shell`. */
  shellArgs: z.array(z.string()).optional(),
});
export const TerminalOpenResponse = z.object({
  terminalId: z.string().min(1),
  /** The shell the host actually spawned (after fallback resolution). */
  shell: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});

export const TerminalWriteRequest = z.object({
  terminalId: z.string().min(1),
  /** Base64-encoded keystroke / paste bytes. Base64 avoids UTF-8 splitting over JSON. */
  dataB64: z.string(),
});
export const TerminalWriteResponse = z.object({ ok: z.literal(true) });

export const TerminalResizeRequest = z.object({
  terminalId: z.string().min(1),
  cols: z.number().int().positive().max(2000),
  rows: z.number().int().positive().max(2000),
});
export const TerminalResizeResponse = z.object({ ok: z.literal(true) });

export const TerminalCloseRequest = z.object({ terminalId: z.string().min(1) });
export const TerminalCloseResponse = z.object({ ok: z.literal(true) });

export const TerminalListRequest = z.object({}).strict();
export const TerminalSummarySchema = z.object({
  terminalId: z.string().min(1),
  cwd: z.string().min(1),
  shell: z.string().min(1),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export type TerminalSummary = z.infer<typeof TerminalSummarySchema>;
export const TerminalListResponse = z.object({ terminals: z.array(TerminalSummarySchema) });

/**
 * Returns the host's capped output ring buffer for a terminal so a freshly-(re)mounted
 * `TerminalView` can repaint recent scrollback before subscribing to the live
 * `terminal.output` stream. `dataB64` is empty when the terminal is unknown / has no output.
 */
export const TerminalSnapshotRequest = z.object({ terminalId: z.string().min(1) });
export const TerminalSnapshotResponse = z.object({ dataB64: z.string() });

export const TerminalDetectShellsRequest = z.object({}).strict();
export const TerminalDetectShellsResponse = z.object({
  shells: z.array(TerminalShellSchema),
  /** Path of the shell used when the user hasn't picked one; null when none was found. */
  defaultPath: z.string().min(1).nullable(),
});

export const CommandSchemas = {
  ping: { request: PingRequest, response: PingResponse },
  "project.list": { request: ProjectListRequest, response: ProjectListResponse },
  "project.open": { request: ProjectOpenRequest, response: ProjectOpenResponse },
  "project.listFiles": {
    request: ProjectListFilesRequest,
    response: ProjectListFilesResponse,
  },
  "session.list": { request: SessionListRequest, response: SessionListResponse },
  "session.create": { request: SessionCreateRequest, response: SessionCreateResponse },
  "session.activate": { request: SessionActivateRequest, response: SessionActivateResponse },
  "session.deactivate": { request: SessionDeactivateRequest, response: SessionDeactivateResponse },
  "session.prompt": { request: SessionPromptRequest, response: SessionPromptResponse },
  "session.cancel": { request: SessionCancelRequest, response: SessionCancelResponse },
  "session.forceStop": { request: SessionForceStopRequest, response: SessionForceStopResponse },
  "session.commands": { request: SessionCommandsRequest, response: SessionCommandsResponse },
  "project.commands": { request: ProjectCommandsRequest, response: ProjectCommandsResponse },
  "skills.list": { request: SkillsListRequest, response: SkillsListResponse },
  "skills.scan": { request: SkillsScanRequest, response: SkillsScanResponse },
  "skills.install": { request: SkillsInstallRequest, response: SkillsInstallResponse },
  "skills.uninstall": { request: SkillsUninstallRequest, response: SkillsUninstallResponse },
  "mcp.list": { request: McpListRequest, response: McpListResponse },
  "mcp.registrySearch": {
    request: McpRegistrySearchRequest,
    response: McpRegistrySearchResponse,
  },
  "mcp.install": { request: McpInstallRequest, response: McpInstallResponse },
  "mcp.setProjectEnabled": {
    request: McpSetProjectEnabledRequest,
    response: McpSetProjectEnabledResponse,
  },
  "mcp.uninstall": { request: McpUninstallRequest, response: McpUninstallResponse },
  "session.archive": { request: SessionArchiveRequest, response: SessionArchiveResponse },
  "session.unarchive": { request: SessionUnarchiveRequest, response: SessionUnarchiveResponse },
  "session.delete": { request: SessionDeleteRequest, response: SessionDeleteResponse },
  "session.rename": { request: SessionRenameRequest, response: SessionRenameResponse },
  "session.listArchived": {
    request: SessionListArchivedRequest,
    response: SessionListArchivedResponse,
  },
  "session.setModel": { request: SessionSetModelRequest, response: SessionSetModelResponse },
  "session.setThinkingLevel": {
    request: SessionSetThinkingLevelRequest,
    response: SessionSetThinkingLevelResponse,
  },
  "session.setAgentMode": {
    request: SessionSetAgentModeRequest,
    response: SessionSetAgentModeResponse,
  },
  "session.setExcludedTools": {
    request: SessionSetExcludedToolsRequest,
    response: SessionSetExcludedToolsResponse,
  },
  "session.approvePlan": {
    request: SessionApprovePlanRequest,
    response: SessionApprovePlanResponse,
  },
  "session.toolApproval": {
    request: SessionToolApprovalRequest,
    response: SessionToolApprovalResponse,
  },
  "plan.file.read": { request: PlanFileReadRequest, response: PlanFileReadResponse },
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
  "git.createBranch": {
    request: GitCreateBranchRequest,
    response: GitCreateBranchResponse,
  },
  "git.status": { request: GitStatusRequest, response: GitStatusResponse },
  "git.log": { request: GitLogRequest, response: GitLogResponse },
  "git.diffHunks": {
    request: GitDiffHunksRequest,
    response: GitDiffHunksResponse,
  },
  "git.fileBaseline": {
    request: GitFileBaselineRequest,
    response: GitFileBaselineResponse,
  },
  "git.commit": { request: GitCommitRequest, response: GitCommitResponse },
  "git.push": { request: GitPushRequest, response: GitPushResponse },
  "git.pull": { request: GitPullRequest, response: GitPullResponse },
  "git.resetSoftHeadParent": {
    request: GitResetSoftHeadParentRequest,
    response: GitResetSoftHeadParentResponse,
  },
  "git.openPrUrl": { request: GitOpenPrUrlRequest, response: GitOpenPrUrlResponse },
  "git.commitUrl": { request: GitCommitUrlRequest, response: GitCommitUrlResponse },
  "git.checkoutPaths": { request: GitCheckoutPathsRequest, response: GitCheckoutPathsResponse },
  "git.stash": { request: GitStashRequest, response: GitStashResponse },
  "git.stashPop": { request: GitStashPopRequest, response: GitStashPopResponse },
  "git.init": { request: GitInitRequest, response: GitInitResponse },
  "git.turnTouches": {
    request: GitTurnTouchesRequest,
    response: GitTurnTouchesResponse,
  },
  "review.list": { request: ReviewListRequest, response: ReviewListResponse },
  "review.accept": { request: ReviewAcceptRequest, response: ReviewAcceptResponse },
  "review.reject": { request: ReviewRejectRequest, response: ReviewRejectResponse },
  "review.acceptFile": {
    request: ReviewAcceptFileRequest,
    response: ReviewAcceptFileResponse,
  },
  "review.rejectFile": {
    request: ReviewRejectFileRequest,
    response: ReviewRejectFileResponse,
  },
  "diff.get": { request: DiffGetRequest, response: DiffGetResponse },
  "session.artefacts.list": {
    request: SessionArtefactsListRequest,
    response: SessionArtefactsListResponse,
  },
  "theme.list": { request: ThemeListRequest, response: ThemeListResponse },
  "theme.get": { request: ThemeGetRequest, response: ThemeGetResponse },
  "theme.setActive": { request: ThemeSetActiveRequest, response: ThemeSetActiveResponse },
  "theme.import": { request: ThemeImportRequest, response: ThemeImportResponse },
  "theme.delete": { request: ThemeDeleteRequest, response: ThemeDeleteResponse },
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
  "fs.tree": { request: FsTreeRequest, response: FsTreeResponse },
  "fs.createFile": { request: FsCreateFileRequest, response: FsCreateFileResponse },
  "fs.createFolder": { request: FsCreateFolderRequest, response: FsCreateFolderResponse },
  "fs.rename": { request: FsRenameRequest, response: FsRenameResponse },
  "fs.move": { request: FsMoveRequest, response: FsMoveResponse },
  "fs.delete": { request: FsDeleteRequest, response: FsDeleteResponse },
  "fs.readFile": { request: FsReadFileRequest, response: FsReadFileResponse },
  "fs.writeFile": { request: FsWriteFileRequest, response: FsWriteFileResponse },
  "terminal.open": { request: TerminalOpenRequest, response: TerminalOpenResponse },
  "terminal.write": { request: TerminalWriteRequest, response: TerminalWriteResponse },
  "terminal.resize": { request: TerminalResizeRequest, response: TerminalResizeResponse },
  "terminal.close": { request: TerminalCloseRequest, response: TerminalCloseResponse },
  "terminal.list": { request: TerminalListRequest, response: TerminalListResponse },
  "terminal.snapshot": { request: TerminalSnapshotRequest, response: TerminalSnapshotResponse },
  "terminal.detectShells": {
    request: TerminalDetectShellsRequest,
    response: TerminalDetectShellsResponse,
  },
  "lsp.status": { request: LspStatusRequest, response: LspStatusResponse },
  "lsp.ensure": { request: LspEnsureRequest, response: LspEnsureResponse },
  "lsp.request": { request: LspRequestRequest, response: LspRequestResponse },
  "lsp.notify": { request: LspNotifyRequest, response: LspNotifyResponse },
  "lsp.shutdown": { request: LspShutdownRequest, response: LspShutdownResponse },
  "lsp.customServers.list": {
    request: LspCustomServersListRequest,
    response: LspCustomServersListResponse,
  },
  "lsp.customServers.upsert": {
    request: LspCustomServersUpsertRequest,
    response: LspCustomServersUpsertResponse,
  },
  "lsp.customServers.delete": {
    request: LspCustomServersDeleteRequest,
    response: LspCustomServersDeleteResponse,
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
