import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import {
  type McpServerInfo,
  type McpServerSpec,
  McpServerSpecSchema,
  type RegistryServer,
} from "../protocol/commands.js";
import { type McpSecretsStore, mcpTokenEnvVar } from "./mcp-secrets.js";
import { estimateToolsTokens, type ToolLike } from "./mcp-tokens.js";

/**
 * Host-side MCP server management for the pi-mcp-adapter.
 *
 * The adapter has no per-server "enabled" flag — a server is active simply by being present
 * in a config file, and a project cannot disable a server defined in the global file. So
 * pi-deck keeps its OWN catalog of installed servers (a JSON file in userData the adapter
 * never reads), and a project's `.pi/mcp.json` is the authoritative enabled set the adapter
 * reads. Enabling a server writes its adapter-recognized subset into `mcpServers[name]`;
 * disabling deletes that key. Writes always preserve every other key in the file.
 */

/** The official MCP registry list endpoint. Name-substring `search` is the only filter. */
const REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0/servers";
const REGISTRY_TIMEOUT_MS = 10_000;
const REGISTRY_PAGE_SIZE = 50;

/* ============================================================
   CATALOG STORE (pi-deck-owned; adapter never reads it)
   ============================================================ */

/**
 * Persistence for pi-deck's installed-server catalog: a single JSON file in the host's
 * userData dir, validated entry-by-entry on load (one bad entry is skipped, not fatal) and
 * written atomically via tmp + rename. Mirrors CustomLspServersStore / MetadataStore.
 */
export class McpCatalogStore {
  private readonly file: string;
  private servers: McpServerSpec[] = [];

  constructor(userDataDir: string) {
    this.file = join(userDataDir, "mcp-catalog.json");
  }

  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch {
      this.servers = [];
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`[mcp] ignoring malformed ${this.file}: ${(err as Error).message}\n`);
      this.servers = [];
      return;
    }
    const list = (parsed as { servers?: unknown })?.servers;
    const out: McpServerSpec[] = [];
    if (Array.isArray(list)) {
      for (const entry of list) {
        const result = McpServerSpecSchema.safeParse(entry);
        if (result.success) out.push(result.data);
        else process.stderr.write(`[mcp] skipping invalid catalog entry in ${this.file}\n`);
      }
    }
    this.servers = out;
  }

  list(): McpServerSpec[] {
    return this.servers.map((s) => ({ ...s }));
  }

  get(name: string): McpServerSpec | undefined {
    const hit = this.servers.find((s) => s.name === name);
    return hit ? { ...hit } : undefined;
  }

  /** Add or replace (by name). */
  async upsert(spec: McpServerSpec): Promise<McpServerSpec[]> {
    const parsed = McpServerSpecSchema.parse(spec);
    const idx = this.servers.findIndex((s) => s.name === parsed.name);
    if (idx === -1) this.servers.push(parsed);
    else this.servers[idx] = parsed;
    await this.save();
    return this.list();
  }

  async delete(name: string): Promise<McpServerSpec[]> {
    this.servers = this.servers.filter((s) => s.name !== name);
    await this.save();
    return this.list();
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ servers: this.servers }, null, 2)}\n`, "utf8");
    await rename(tmp, this.file);
  }
}

/* ============================================================
   PER-PROJECT .pi/mcp.json (adapter reads this)
   ============================================================ */

function projectMcpPath(projectPath: string): string {
  return join(projectPath, ".pi", "mcp.json");
}

/** Absolute path of a project's `.pi/mcp.json` — the per-project install location. */
export function projectMcpConfigPath(projectPath: string): string {
  return projectMcpPath(projectPath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Read a project's `.pi/mcp.json`, tolerating a missing or malformed file. */
export async function readProjectMcp(
  projectPath: string,
): Promise<{ raw: Record<string, unknown>; mcpServers: Record<string, unknown> }> {
  try {
    const parsed = JSON.parse(await readFile(projectMcpPath(projectPath), "utf8"));
    const raw = asRecord(parsed);
    return { raw, mcpServers: asRecord(raw.mcpServers) };
  } catch {
    return { raw: {}, mcpServers: {} };
  }
}

/**
 * Set (or, with `entry === null`, delete) `mcpServers[name]` in a project's `.pi/mcp.json`,
 * preserving every other key in the file. Creates `.pi/` and the file when absent.
 */
export async function setProjectServer(
  projectPath: string,
  name: string,
  entry: Record<string, unknown> | null,
): Promise<void> {
  const file = projectMcpPath(projectPath);
  const { raw } = await readProjectMcp(projectPath);
  const mcpServers = { ...asRecord(raw.mcpServers) };
  if (entry === null) delete mcpServers[name];
  else mcpServers[name] = entry;
  const next = { ...raw, mcpServers };
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

/** The adapter-recognized subset of a spec — what actually gets written into mcp.json. */
export function toAdapterEntry(spec: McpServerSpec): Record<string, unknown> {
  const entry: Record<string, unknown> = {};
  if (spec.transport === "http") {
    if (spec.url) entry.url = spec.url;
    if (spec.headers) entry.headers = spec.headers;
  } else {
    if (spec.command) entry.command = spec.command;
    if (spec.args) entry.args = spec.args;
  }
  if (spec.env) entry.env = spec.env;
  if (spec.auth) entry.auth = spec.auth;
  if (spec.bearerTokenEnv) entry.bearerTokenEnv = spec.bearerTokenEnv;
  if (spec.lifecycle) entry.lifecycle = spec.lifecycle;
  // Idle timeout only disconnects lazy servers; the adapter ignores it otherwise. 0 = never.
  if (spec.lifecycle === "lazy" && spec.idleTimeout !== undefined) {
    entry.idleTimeout = spec.idleTimeout;
  }
  // "direct" promotes every tool to a first-class tool; "proxy" (default) omits the key.
  if (spec.expose === "direct") entry.directTools = true;
  return entry;
}

function stringRecord(value: unknown): Record<string, string> | undefined {
  const rec = asRecord(value);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec)) if (typeof v === "string") out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

/** Server info before the adapter's per-server cache stats are attached. */
type McpServerBaseInfo = Omit<
  McpServerInfo,
  "toolCount" | "cached" | "hasToken" | "estimatedTokens"
>;

/** Build a display spec for a server that lives only in a project file (hand-added). */
function specFromProjectEntry(name: string, value: unknown): McpServerBaseInfo {
  const entry = asRecord(value);
  const url = typeof entry.url === "string" ? entry.url : undefined;
  const lifecycle =
    entry.lifecycle === "eager" || entry.lifecycle === "keep-alive" ? entry.lifecycle : "lazy";
  return {
    name,
    transport: url ? "http" : "stdio",
    command: typeof entry.command === "string" ? entry.command : undefined,
    args: Array.isArray(entry.args) ? entry.args.filter((a) => typeof a === "string") : undefined,
    url,
    env: stringRecord(entry.env),
    headers: stringRecord(entry.headers),
    auth: entry.auth === "bearer" || entry.auth === "oauth" ? entry.auth : undefined,
    bearerTokenEnv: typeof entry.bearerTokenEnv === "string" ? entry.bearerTokenEnv : undefined,
    lifecycle,
    idleTimeout: typeof entry.idleTimeout === "number" ? entry.idleTimeout : undefined,
    expose: entry.directTools ? "direct" : "proxy",
    enabledInProject: true,
    source: "project",
  };
}

interface AdapterCacheEntry {
  toolCount: number;
  cachedAt: number;
  /** chars/4 estimate of the tokens this server's tool/resource defs add when registered directly. */
  estimatedTokens: number;
}

/** Read the adapter's tool-metadata cache (`<agentDir>/mcp-cache.json`); best-effort. */
export async function loadAdapterCache(
  agentDir = getAgentDir(),
): Promise<Map<string, AdapterCacheEntry>> {
  const out = new Map<string, AdapterCacheEntry>();
  try {
    const parsed = JSON.parse(await readFile(join(agentDir, "mcp-cache.json"), "utf8"));
    const servers = asRecord(asRecord(parsed).servers);
    for (const [name, value] of Object.entries(servers)) {
      const entry = asRecord(value);
      const toolDefs = Array.isArray(entry.tools) ? entry.tools : [];
      const resourceDefs = Array.isArray(entry.resources) ? entry.resources : [];
      const cachedAt = typeof entry.cachedAt === "number" ? entry.cachedAt : 0;
      const estimatedTokens = estimateToolsTokens([
        ...toolDefs.map((t) => cachedToolLike(asRecord(t))),
        ...resourceDefs.map((r) => cachedToolLike(asRecord(r))),
      ]);
      out.set(name, {
        toolCount: toolDefs.length + resourceDefs.length,
        cachedAt,
        estimatedTokens,
      });
    }
  } catch {
    /* no cache yet */
  }
  return out;
}

/** Coerce a cached tool/resource record into the estimator's loose `ToolLike` shape. */
function cachedToolLike(rec: Record<string, unknown>): ToolLike {
  return {
    name: typeof rec.name === "string" ? rec.name : undefined,
    description: typeof rec.description === "string" ? rec.description : undefined,
    inputSchema: rec.inputSchema,
  };
}

/** Drop a server's cached metadata so the adapter reconnects and re-discovers tools next run. */
export async function clearAdapterCacheEntry(
  name: string,
  agentDir = getAgentDir(),
): Promise<void> {
  const file = join(agentDir, "mcp-cache.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch {
    return;
  }
  const servers = asRecord(asRecord(parsed).servers);
  if (!(name in servers)) return;
  delete servers[name];
  const next = { ...asRecord(parsed), servers };
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

/**
 * The servers shown on the MCP page for a project: the union of the catalog and whatever the
 * project's `.pi/mcp.json` already enables, with per-project enablement flags and the adapter's
 * cached tool counts.
 */
export async function listServers(
  projectPath: string,
  catalog: McpServerSpec[],
  opts: { agentDir?: string; tokenNames?: Set<string> } = {},
): Promise<McpServerInfo[]> {
  const agentDir = opts.agentDir ?? getAgentDir();
  const tokenNames = opts.tokenNames ?? new Set<string>();
  const { mcpServers } = await readProjectMcp(projectPath);
  const cache = await loadAdapterCache(agentDir);
  const enabled = new Set(Object.keys(mcpServers));
  const attach = (base: McpServerBaseInfo): McpServerInfo => {
    const hit = cache.get(base.name);
    return {
      ...base,
      toolCount: hit ? hit.toolCount : null,
      cached: hit !== undefined,
      hasToken: tokenNames.has(base.name),
      estimatedTokens: hit ? hit.estimatedTokens : null,
    };
  };
  const byName = new Map<string, McpServerInfo>();
  for (const spec of catalog) {
    const on = enabled.has(spec.name);
    byName.set(
      spec.name,
      attach({ ...spec, enabledInProject: on, source: on ? "both" : "catalog" }),
    );
  }
  for (const name of enabled) {
    if (byName.has(name)) continue;
    byName.set(name, attach(specFromProjectEntry(name, mcpServers[name])));
  }
  return [...byName.values()];
}

/**
 * Apply a Configure-panel change. A catalog server is updated in the catalog and — when it's
 * enabled for the project — its `.pi/mcp.json` entry is re-written. A project-only (hand-added)
 * server is edited in place in the project file.
 */
export async function applyServerConfig(
  catalog: McpCatalogStore,
  projectPath: string,
  name: string,
  changes: Partial<Pick<McpServerSpec, "lifecycle" | "expose" | "idleTimeout">>,
): Promise<void> {
  const inCatalog = catalog.get(name);
  if (inCatalog) {
    const updated: McpServerSpec = { ...inCatalog, ...changes };
    await catalog.upsert(updated);
    const { mcpServers } = await readProjectMcp(projectPath);
    if (name in mcpServers) await setProjectServer(projectPath, name, toAdapterEntry(updated));
    return;
  }
  const { mcpServers } = await readProjectMcp(projectPath);
  if (!(name in mcpServers)) throw new Error(`"${name}" is not installed`);
  const updated: McpServerSpec = { ...specFromProjectEntry(name, mcpServers[name]), ...changes };
  await setProjectServer(projectPath, name, toAdapterEntry(updated));
}

/**
 * Store (or clear, with `token: null`) a server's bearer token. The secret is encrypted in the
 * secrets store; the config only gains a `bearerTokenEnv` reference (+ `auth: "bearer"`). Catalog
 * servers update the catalog and their enabled project entry; project-only servers are edited in
 * place. The decrypted token reaches the adapter as a worker env var on the next spawn.
 */
export async function applyServerToken(
  catalog: McpCatalogStore,
  secrets: McpSecretsStore,
  projectPath: string,
  name: string,
  token: string | null,
): Promise<void> {
  const trimmed = token?.trim() ?? "";
  const set = trimmed.length > 0;
  if (set) await secrets.set(name, trimmed);
  else await secrets.delete(name);

  const apply = (spec: McpServerSpec): McpServerSpec => {
    if (set) return { ...spec, auth: "bearer", bearerTokenEnv: mcpTokenEnvVar(name) };
    const next: McpServerSpec = { ...spec };
    delete next.bearerTokenEnv;
    return next;
  };

  const inCatalog = catalog.get(name);
  if (inCatalog) {
    const updated = apply(inCatalog);
    await catalog.upsert(updated);
    const { mcpServers } = await readProjectMcp(projectPath);
    if (name in mcpServers) await setProjectServer(projectPath, name, toAdapterEntry(updated));
    return;
  }
  // Project-only server: edit the entry in place. (If it isn't in the file, the secret is still
  // saved and will apply once the server is enabled.)
  const { mcpServers } = await readProjectMcp(projectPath);
  if (!(name in mcpServers)) return;
  const updated = apply(specFromProjectEntry(name, mcpServers[name]));
  await setProjectServer(projectPath, name, toAdapterEntry(updated));
}

/* ============================================================
   ADAPTER STATUS (best-effort)
   ============================================================ */

/**
 * Best-effort probe of whether the pi-mcp-adapter extension is installed. Detection is not
 * critical — the status strip is informational — so any failure reports "not installed".
 */
export async function getAdapterStatus(
  agentDir = getAgentDir(),
): Promise<{ installed: boolean; version: string | null }> {
  try {
    const extDir = join(agentDir, "extensions");
    const entries = await readdir(extDir).catch(() => [] as string[]);
    const match = entries.find((e) => e.toLowerCase().includes("pi-mcp-adapter"));
    if (!match) return { installed: false, version: null };
    let version: string | null = null;
    try {
      const pkg = JSON.parse(await readFile(join(extDir, match, "package.json"), "utf8"));
      if (pkg && typeof pkg.version === "string") version = pkg.version;
    } catch {
      /* version is cosmetic */
    }
    return { installed: true, version };
  } catch {
    return { installed: false, version: null };
  }
}

/* ============================================================
   REGISTRY SEARCH + NORMALIZATION
   ============================================================ */

/** `io.github.modelcontextprotocol/server-slack` → `server`-key `slack`. */
function sanitizeName(fullName: string): string {
  const tail = fullName.split("/").pop() ?? fullName;
  const cleaned = tail.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "server";
}

/** Prettier display label, dropping common `mcp-server-` style prefixes. */
function prettyName(fullName: string): string {
  const tail = fullName.split("/").pop() ?? fullName;
  const words = tail
    .replace(/^(mcp-server-|server-|mcp-)/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  const out = words || tail;
  return out.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Last segment of the reverse-DNS namespace, e.g. `io.github.owner/x` → `owner`. */
function publisherOf(fullName: string): string {
  const ns = fullName.split("/")[0] ?? "";
  const parts = ns.split(".");
  return parts[parts.length - 1] || ns;
}

function envFromRegistry(value: unknown): Record<string, string> | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const e of value) {
    const name = asRecord(e).name;
    if (typeof name === "string" && name) out[name] = `\${${name}}`;
  }
  return Object.keys(out).length ? out : undefined;
}

function headersFromRegistry(value: unknown): Record<string, string> | undefined {
  if (Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const h of value) {
      const rec = asRecord(h);
      const name = rec.name;
      if (typeof name === "string") {
        out[name] = typeof rec.value === "string" ? rec.value : `\${${name}}`;
      }
    }
    return Object.keys(out).length ? out : undefined;
  }
  return stringRecord(value);
}

/**
 * Derive an installable spec from a registry `server` object. Prefers a hosted remote (http)
 * endpoint; otherwise builds a stdio command from the first runnable package. Returns null
 * when there's nothing runnable to install.
 */
export function deriveSpec(
  server: Record<string, unknown>,
  fullName: string,
): McpServerSpec | null {
  const name = sanitizeName(fullName);

  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const remote = remotes.map(asRecord).find((r) => typeof r.url === "string");
  if (remote) {
    return {
      name,
      transport: "http",
      url: remote.url as string,
      headers: headersFromRegistry(remote.headers),
      lifecycle: "lazy",
      packageId: remote.url as string,
    };
  }

  const packages = Array.isArray(server.packages) ? server.packages.map(asRecord) : [];
  const pkg =
    packages.find((p) => p.registryType === "npm" && typeof p.identifier === "string") ??
    packages.find((p) => typeof p.identifier === "string");
  if (pkg && typeof pkg.identifier === "string") {
    const runtime = typeof pkg.runtimeHint === "string" ? pkg.runtimeHint : "npx";
    const version = typeof pkg.version === "string" ? pkg.version : undefined;
    const idWithVer = version ? `${pkg.identifier}@${version}` : pkg.identifier;
    const args = runtime === "npx" ? ["-y", idWithVer] : [idWithVer];
    return {
      name,
      transport: "stdio",
      command: runtime,
      args,
      env: envFromRegistry(pkg.environmentVariables),
      lifecycle: "lazy",
      packageId: pkg.identifier,
    };
  }

  return null;
}

/** Normalize one registry list row (tolerating the `{ server, _meta }` envelope). */
export function normalizeRegistryServer(row: unknown): RegistryServer | null {
  const item = asRecord(row);
  const server = asRecord(item.server && typeof item.server === "object" ? item.server : item);
  const fullName = typeof server.name === "string" ? server.name : undefined;
  if (!fullName) return null;
  const spec = deriveSpec(server, fullName);
  if (!spec) return null;
  return {
    id: fullName,
    name: prettyName(fullName),
    description: typeof server.description === "string" ? server.description : "",
    publisher: publisherOf(fullName),
    transport: spec.transport,
    packageId: spec.packageId ?? "",
    spec,
  };
}

/** Query the official registry by name substring (the only filter the API supports). */
export async function searchRegistry(
  query?: string,
  cursor?: string,
): Promise<{ servers: RegistryServer[]; nextCursor?: string }> {
  const params = new URLSearchParams({ limit: String(REGISTRY_PAGE_SIZE) });
  if (query?.trim()) params.set("search", query.trim());
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${REGISTRY_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Registry request failed (${res.status})`);

  const payload = (await res.json()) as {
    servers?: unknown[];
    metadata?: { nextCursor?: unknown };
  };
  const rows = Array.isArray(payload.servers) ? payload.servers : [];
  const servers: RegistryServer[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const normalized = normalizeRegistryServer(row);
    if (!normalized) continue;
    // The registry returns a row per published version (and occasionally distinct entries that
    // resolve to the same install target), so collapse by transport + package/url.
    const key = `${normalized.transport}:${normalized.packageId || normalized.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    servers.push(normalized);
  }
  const nextCursor =
    typeof payload.metadata?.nextCursor === "string" ? payload.metadata.nextCursor : undefined;
  return nextCursor ? { servers, nextCursor } : { servers };
}
