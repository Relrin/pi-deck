import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  applyServerConfig,
  applyServerToken,
  clearAdapterCacheEntry,
  deriveSpec,
  listServers,
  loadAdapterCache,
  McpCatalogStore,
  normalizeRegistryServer,
  readProjectMcp,
  setProjectServer,
  toAdapterEntry,
} from "../../src/host/mcp.js";
import { McpSecretsStore, mcpTokenEnvVar, setSecretCrypto } from "../../src/host/mcp-secrets.js";
import type { McpServerSpec } from "../../src/protocol/commands.js";

// Reversible base64 stand-in for the OS keychain (real encryption is injected by the desktop app).
setSecretCrypto({
  available: () => true,
  encrypt: (s) => Buffer.from(s, "utf8").toString("base64"),
  decrypt: (b) => Buffer.from(b, "base64").toString("utf8"),
});

let project: string;

beforeEach(async () => {
  project = await mkdtemp(join(tmpdir(), "pideck-mcp-"));
});

afterEach(async () => {
  await rm(project, { recursive: true, force: true });
});

async function writeProjectMcp(content: unknown): Promise<void> {
  await mkdir(join(project, ".pi"), { recursive: true });
  await writeFile(
    join(project, ".pi", "mcp.json"),
    `${JSON.stringify(content, null, 2)}\n`,
    "utf8",
  );
}

async function readRawMcp(): Promise<Record<string, unknown>> {
  const raw = await readFile(join(project, ".pi", "mcp.json"), "utf8");
  return JSON.parse(raw);
}

const fooSpec: McpServerSpec = {
  name: "server-foo",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@acme/foo@1.2.3"],
  lifecycle: "lazy",
  description: "A foo server",
  publisher: "acme",
  packageId: "@acme/foo",
};

describe("setProjectServer", () => {
  test("creates .pi/mcp.json when absent", async () => {
    await setProjectServer(project, "server-foo", toAdapterEntry(fooSpec));
    const raw = await readRawMcp();
    expect(raw.mcpServers).toMatchObject({
      "server-foo": { command: "npx", args: ["-y", "@acme/foo@1.2.3"] },
    });
  });

  test("preserves other servers and top-level keys", async () => {
    await writeProjectMcp({
      settings: { toolPrefix: "server" },
      mcpServers: { existing: { command: "existing-cmd" } },
    });

    await setProjectServer(project, "server-foo", toAdapterEntry(fooSpec));
    let raw = await readRawMcp();
    expect(raw.settings).toEqual({ toolPrefix: "server" });
    expect(Object.keys(raw.mcpServers as object).sort()).toEqual(["existing", "server-foo"]);

    // Disabling only removes its own key.
    await setProjectServer(project, "existing", null);
    raw = await readRawMcp();
    expect(raw.settings).toEqual({ toolPrefix: "server" });
    expect(Object.keys(raw.mcpServers as object)).toEqual(["server-foo"]);
  });

  test("tolerates a missing / malformed file on read", async () => {
    expect(await readProjectMcp(project)).toEqual({ raw: {}, mcpServers: {} });
    await writeFile(join(project, ".pi", "mcp.json"), "{ not json", "utf8").catch(() => {});
  });
});

describe("toAdapterEntry", () => {
  test("keeps adapter keys and drops display-only fields", () => {
    const entry = toAdapterEntry(fooSpec);
    expect(entry).toEqual({
      command: "npx",
      args: ["-y", "@acme/foo@1.2.3"],
      lifecycle: "lazy",
    });
    expect(entry).not.toHaveProperty("description");
    expect(entry).not.toHaveProperty("publisher");
    expect(entry).not.toHaveProperty("packageId");
  });

  test("uses url/headers for http transport", () => {
    const entry = toAdapterEntry({
      name: "bar",
      transport: "http",
      url: "https://mcp.acme.dev/mcp",
      headers: { Authorization: "Bearer x" },
      lifecycle: "lazy",
    });
    expect(entry).toEqual({
      url: "https://mcp.acme.dev/mcp",
      headers: { Authorization: "Bearer x" },
      lifecycle: "lazy",
    });
  });
});

describe("deriveSpec", () => {
  test("builds a stdio spec from an npm package", () => {
    const spec = deriveSpec(
      {
        name: "io.github.acme/server-foo",
        packages: [
          {
            registryType: "npm",
            identifier: "@acme/foo",
            version: "1.2.3",
            transport: { type: "stdio" },
            runtimeHint: "npx",
            environmentVariables: [{ name: "FOO_KEY", required: true }],
          },
        ],
      },
      "io.github.acme/server-foo",
    );
    expect(spec).toEqual({
      name: "server-foo",
      transport: "stdio",
      command: "npx",
      args: ["-y", "@acme/foo@1.2.3"],
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the literal ${FOO_KEY} is the expected env placeholder
      env: { FOO_KEY: "${FOO_KEY}" },
      lifecycle: "lazy",
      packageId: "@acme/foo",
    });
  });

  test("prefers a hosted remote (http) endpoint", () => {
    const spec = deriveSpec(
      {
        name: "io.github.acme/bar",
        remotes: [
          {
            type: "streamable-http",
            url: "https://mcp.acme.dev/mcp",
            headers: [{ name: "Authorization", value: "Bearer x" }],
          },
        ],
      },
      "io.github.acme/bar",
    );
    expect(spec).toEqual({
      name: "bar",
      transport: "http",
      url: "https://mcp.acme.dev/mcp",
      headers: { Authorization: "Bearer x" },
      lifecycle: "lazy",
      packageId: "https://mcp.acme.dev/mcp",
    });
  });

  test("returns null when nothing is runnable", () => {
    expect(deriveSpec({ name: "io.github.acme/empty" }, "io.github.acme/empty")).toBeNull();
  });
});

describe("normalizeRegistryServer", () => {
  test("unwraps the { server, _meta } envelope and derives publisher / name", () => {
    const normalized = normalizeRegistryServer({
      server: {
        name: "io.github.modelcontextprotocol/server-slack",
        description: "Slack server",
        packages: [{ registryType: "npm", identifier: "@mcp/slack", transport: { type: "stdio" } }],
      },
      _meta: { "io.modelcontextprotocol.registry/official": { status: "active" } },
    });
    expect(normalized).toMatchObject({
      id: "io.github.modelcontextprotocol/server-slack",
      name: "Slack",
      description: "Slack server",
      publisher: "modelcontextprotocol",
      transport: "stdio",
      packageId: "@mcp/slack",
    });
    expect(normalized?.spec.name).toBe("server-slack");
  });
});

describe("toAdapterEntry (config)", () => {
  test("writes directTools: true for direct exposure, omits it for proxy", () => {
    expect(toAdapterEntry({ ...fooSpec, expose: "direct" }).directTools).toBe(true);
    expect(toAdapterEntry({ ...fooSpec, expose: "proxy" })).not.toHaveProperty("directTools");
  });

  test("writes idleTimeout only for the lazy lifecycle (0 = never)", () => {
    expect(toAdapterEntry({ ...fooSpec, lifecycle: "lazy", idleTimeout: 30 }).idleTimeout).toBe(30);
    expect(toAdapterEntry({ ...fooSpec, lifecycle: "lazy", idleTimeout: 0 }).idleTimeout).toBe(0);
    expect(
      toAdapterEntry({ ...fooSpec, lifecycle: "keep-alive", idleTimeout: 30 }),
    ).not.toHaveProperty("idleTimeout");
  });

  test("writes bearerTokenEnv when set", () => {
    expect(toAdapterEntry({ ...fooSpec, bearerTokenEnv: "PI_DECK_MCP_X" }).bearerTokenEnv).toBe(
      "PI_DECK_MCP_X",
    );
  });
});

describe("McpSecretsStore", () => {
  test("stores, injects, persists encrypted, and clears tokens", async () => {
    const store = new McpSecretsStore(project);
    await store.load();
    expect(store.has("trading")).toBe(false);

    await store.set("trading", "sk-secret");
    expect(store.has("trading")).toBe(true);
    expect(store.names()).toEqual(["trading"]);
    expect(store.envVars()).toEqual({ [mcpTokenEnvVar("trading")]: "sk-secret" });

    // The token survives a reload but is never on disk in plaintext.
    const raw = await readFile(join(project, "mcp-secrets.json"), "utf8");
    expect(raw).not.toContain("sk-secret");
    const reloaded = new McpSecretsStore(project);
    await reloaded.load();
    expect(reloaded.envVars()).toEqual({ [mcpTokenEnvVar("trading")]: "sk-secret" });

    await store.delete("trading");
    expect(store.has("trading")).toBe(false);
  });

  test("mcpTokenEnvVar sanitizes the server name", () => {
    expect(mcpTokenEnvVar("trading")).toBe("PI_DECK_MCP_TRADING");
    expect(mcpTokenEnvVar("server-foo.bar")).toBe("PI_DECK_MCP_SERVER_FOO_BAR");
  });
});

describe("applyServerToken", () => {
  const httpSpec: McpServerSpec = {
    name: "trading",
    transport: "http",
    url: "https://api.trade/mcp",
    lifecycle: "lazy",
  };

  test("stores the secret and writes only bearerTokenEnv (no plaintext) to the enabled entry", async () => {
    const catalog = new McpCatalogStore(project);
    const secrets = new McpSecretsStore(project);
    await secrets.load();
    await catalog.upsert(httpSpec);
    await setProjectServer(project, "trading", toAdapterEntry(httpSpec));

    await applyServerToken(catalog, secrets, project, "trading", "sk-secret");

    expect(secrets.has("trading")).toBe(true);
    expect(catalog.get("trading")).toMatchObject({
      auth: "bearer",
      bearerTokenEnv: mcpTokenEnvVar("trading"),
    });
    const raw = await readRawMcp();
    const entry = (raw.mcpServers as Record<string, Record<string, unknown>>).trading;
    expect(entry?.bearerTokenEnv).toBe(mcpTokenEnvVar("trading"));
    expect(entry?.auth).toBe("bearer");
    expect(JSON.stringify(raw)).not.toContain("sk-secret");

    // Clearing removes the secret and the bearerTokenEnv reference.
    await applyServerToken(catalog, secrets, project, "trading", null);
    expect(secrets.has("trading")).toBe(false);
    expect(catalog.get("trading")?.bearerTokenEnv).toBeUndefined();
  });
});

describe("adapter cache", () => {
  test("loadAdapterCache counts tools + resources; clear removes one entry", async () => {
    await writeFile(
      join(project, "mcp-cache.json"),
      JSON.stringify({
        version: 1,
        servers: {
          "server-foo": {
            tools: [{ name: "a" }, { name: "b" }],
            resources: [{ uri: "u", name: "r" }],
          },
          other: { tools: [{ name: "c" }], resources: [] },
        },
      }),
      "utf8",
    );

    const loaded = await loadAdapterCache(project);
    expect(loaded.get("server-foo")?.toolCount).toBe(3);
    expect(loaded.get("other")?.toolCount).toBe(1);
    // chars/4 estimate over each def: a sparse `{ name }` def is 12 tokens; server-foo has two
    // tools + one resource (3 × 12 = 36), "other" a single tool (12).
    expect(loaded.get("server-foo")?.estimatedTokens).toBe(36);
    expect(loaded.get("other")?.estimatedTokens).toBe(12);

    await clearAdapterCacheEntry("server-foo", project);
    const after = await loadAdapterCache(project);
    expect(after.has("server-foo")).toBe(false);
    expect(after.has("other")).toBe(true);
  });
});

describe("applyServerConfig", () => {
  test("updates the catalog and rewrites the enabled project entry", async () => {
    const catalog = new McpCatalogStore(project);
    await catalog.upsert(fooSpec);
    await setProjectServer(project, "server-foo", toAdapterEntry(fooSpec));

    await applyServerConfig(catalog, project, "server-foo", {
      expose: "direct",
      lifecycle: "lazy",
      idleTimeout: 30,
    });

    expect(catalog.get("server-foo")?.expose).toBe("direct");
    const raw = await readRawMcp();
    const entry = (raw.mcpServers as Record<string, Record<string, unknown>>)["server-foo"];
    expect(entry?.directTools).toBe(true);
    expect(entry?.idleTimeout).toBe(30);
  });

  test("does not create a project entry for a disabled server", async () => {
    const catalog = new McpCatalogStore(project);
    await catalog.upsert(fooSpec);

    await applyServerConfig(catalog, project, "server-foo", { lifecycle: "eager" });

    expect(catalog.get("server-foo")?.lifecycle).toBe("eager");
    const { mcpServers } = await readProjectMcp(project);
    expect("server-foo" in mcpServers).toBe(false);
  });
});

describe("listServers", () => {
  test("unions catalog + project entries, flags enablement, attaches tool counts", async () => {
    await writeProjectMcp({
      mcpServers: {
        "server-foo": toAdapterEntry(fooSpec),
        handadded: { command: "hand", args: ["run"] },
      },
    });
    await writeFile(
      join(project, "mcp-cache.json"),
      JSON.stringify({
        version: 1,
        servers: { "server-foo": { tools: [{ name: "a" }, { name: "b" }], resources: [] } },
      }),
      "utf8",
    );

    const bazSpec: McpServerSpec = {
      name: "baz",
      transport: "http",
      url: "https://baz.dev/mcp",
      lifecycle: "lazy",
    };

    // Pass `project` as the agent dir so the cache lookup is hermetic.
    const servers = await listServers(project, [fooSpec, bazSpec], {
      agentDir: project,
      tokenNames: new Set(["server-foo"]),
    });
    const byName = new Map(servers.map((s) => [s.name, s]));

    expect(byName.get("server-foo")).toMatchObject({
      enabledInProject: true,
      source: "both",
      cached: true,
      toolCount: 2,
      estimatedTokens: 24, // two sparse tool defs × 12
      hasToken: true,
    });
    expect(byName.get("baz")).toMatchObject({
      enabledInProject: false,
      source: "catalog",
      cached: false,
      toolCount: null,
      estimatedTokens: null,
      hasToken: false,
    });
    expect(byName.get("handadded")).toMatchObject({
      enabledInProject: true,
      source: "project",
      transport: "stdio",
      command: "hand",
    });
  });
});
