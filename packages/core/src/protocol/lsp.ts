import { z } from "zod";

/**
 * Wire schemas for the LSP passthrough. The host owns the server *processes*; the renderer's
 * `@codemirror/lsp-client` owns the LSP session (initialize handshake, document sync). The
 * commands below are a thin, method-allowlisted JSON-RPC pipe — `lsp.request` / `lsp.notify`
 * carry `{ method, params }` verbatim, and server -> client traffic flows back as events.
 *
 * URIs in `params` / `result` / event payloads are **server-form** end to end (the path as the
 * server's environment sees it). The renderer converts at the editor boundary using `mapping`.
 */

export const LspMappingSchema = z.union([
  z.object({ kind: z.literal("local") }),
  z.object({ kind: z.literal("wsl"), distro: z.string().min(1) }),
]);

/** Availability snapshot for the settings UI. `running` reflects a live child process. */
export const LspServerStatusInfoSchema = z.object({
  serverId: z.string().min(1),
  label: z.string().min(1),
  languageIds: z.array(z.string()),
  command: z.string().min(1),
  available: z.boolean(),
  running: z.boolean(),
  installHint: z.string(),
});
export type LspServerStatusInfo = z.infer<typeof LspServerStatusInfoSchema>;

export const LspStatusRequest = z.object({
  projectId: z.string().uuid(),
  /** Re-probe PATH / the WSL distro instead of serving the per-run detection cache. */
  refresh: z.boolean().optional(),
});
export const LspStatusResponse = z.object({
  mapping: LspMappingSchema,
  servers: z.array(LspServerStatusInfoSchema),
});

/**
 * Lazily spawn (or reuse) the server covering `languageId` for the project. "running" means
 * the child process is up — the renderer connects its LSP client and runs `initialize` itself.
 */
export const LspEnsureRequest = z.object({
  projectId: z.string().uuid(),
  languageId: z.string().min(1),
});
export const LspEnsureResponse = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("running"),
    /** Opaque handle for subsequent lsp.request / lsp.notify / events. */
    key: z.string().min(1),
    serverId: z.string().min(1),
    /** Server-form root URI; the renderer passes this to its LSP client verbatim. */
    rootUri: z.string().min(1),
    mapping: LspMappingSchema,
  }),
  z.object({
    status: z.literal("missing"),
    serverId: z.string().min(1),
    installHint: z.string(),
  }),
  z.object({ status: z.literal("unsupported") }),
]);

export const LspRequestRequest = z.object({
  key: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown(),
  /** The renderer's JSON-RPC id — `$/cancelRequest` is matched against it host-side. */
  clientRequestId: z.union([z.string(), z.number()]),
});
/** LSP-level failures travel in-band so the renderer can fabricate a JSON-RPC error response. */
export const LspResponseErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});
export const LspRequestResponse = z.object({
  result: z.unknown().optional(),
  error: LspResponseErrorSchema.optional(),
});

export const LspNotifyRequest = z.object({
  key: z.string().min(1),
  method: z.string().min(1),
  params: z.unknown(),
});
export const LspNotifyResponse = z.object({ ok: z.literal(true) });

export const LspShutdownRequest = z.object({ key: z.string().min(1) });
export const LspShutdownResponse = z.object({ ok: z.literal(true) });

/** Server→client notification (anything but publishDiagnostics), as a raw JSON-RPC message. */
export const LspMessagePayload = z.object({
  key: z.string().min(1),
  message: z.unknown(),
});

/** `textDocument/publishDiagnostics`, flattened. `uri` is server-form. */
export const LspDiagnosticsPayload = z.object({
  key: z.string().min(1),
  uri: z.string().min(1),
  version: z.number().int().optional(),
  diagnostics: z.array(z.unknown()),
});

/** Process-level state changes (spawn, clean exit, crash). */
export const LspServerStatusPayload = z.object({
  key: z.string().min(1),
  serverId: z.string().min(1),
  projectId: z.string().min(1),
  status: z.enum(["running", "exited", "crashed"]),
  message: z.string().optional(),
});
