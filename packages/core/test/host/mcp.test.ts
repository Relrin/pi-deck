import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  deriveSpec,
  listServers,
  normalizeRegistryServer,
  readProjectMcp,
  setProjectServer,
  toAdapterEntry,
} from "../../src/host/mcp.js";
import type { McpServerSpec } from "../../src/protocol/commands.js";

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

describe("listServers", () => {
  test("unions the catalog with project entries and flags enablement", async () => {
    await writeProjectMcp({
      mcpServers: {
        "server-foo": toAdapterEntry(fooSpec),
        handadded: { command: "hand", args: ["run"] },
      },
    });

    const bazSpec: McpServerSpec = {
      name: "baz",
      transport: "http",
      url: "https://baz.dev/mcp",
      lifecycle: "lazy",
    };

    const servers = await listServers(project, [fooSpec, bazSpec]);
    const byName = new Map(servers.map((s) => [s.name, s]));

    expect(byName.get("server-foo")).toMatchObject({ enabledInProject: true, source: "both" });
    expect(byName.get("baz")).toMatchObject({ enabledInProject: false, source: "catalog" });
    expect(byName.get("handadded")).toMatchObject({
      enabledInProject: true,
      source: "project",
      transport: "stdio",
      command: "hand",
    });
  });
});
