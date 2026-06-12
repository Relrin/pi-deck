import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CustomLspServersStore } from "../../src/lsp/custom-servers-store.js";
import type { CustomLspServer } from "../../src/protocol/lsp.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-lsp-custom-"));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

const ELIXIR: CustomLspServer = {
  id: "elixir",
  label: "Elixir",
  languageIds: ["elixir", "phoenix-heex"],
  extensions: ["ex", "exs", "heex:phoenix-heex"],
  command: "elixir-ls",
  args: [],
  installHint: "install elixir-ls",
};

describe("CustomLspServersStore", () => {
  test("load with no file yields an empty list", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.list()).toEqual([]);
  });

  test("upsert persists; a fresh store reads the entry back", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    await store.upsert(ELIXIR);

    const reread = new CustomLspServersStore(tmpDir);
    await reread.load();
    expect(reread.list()).toEqual([ELIXIR]);
    expect(reread.toDefs()[0]?.installHint).toBe("install elixir-ls");
  });

  test("upsert replaces an existing entry by id", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    await store.upsert(ELIXIR);
    await store.upsert({ ...ELIXIR, command: "language_server.sh" });
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]?.command).toBe("language_server.sh");
  });

  test("upsert rejects built-in id collisions", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.upsert({ ...ELIXIR, id: "typescript" })).rejects.toThrow(/built-in/);
  });

  test("upsert rejects colon mappings pointing outside the server's languageIds", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.upsert({ ...ELIXIR, extensions: ["ex", "foo:unknown-lang"] })).rejects.toThrow(
      /unknown-lang/,
    );
  });

  test("upsert rejects malformed ids", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.upsert({ ...ELIXIR, id: "Has Spaces" })).rejects.toThrow();
  });

  test("delete removes the entry and persists", async () => {
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    await store.upsert(ELIXIR);
    await store.delete("elixir");
    expect(store.list()).toEqual([]);

    const raw = JSON.parse(await readFile(join(tmpDir, "lsp-servers.json"), "utf8"));
    expect(raw.servers).toEqual([]);
  });

  test("load skips invalid entries and built-in-id squatters, keeps valid ones", async () => {
    await writeFile(
      join(tmpDir, "lsp-servers.json"),
      JSON.stringify({
        servers: [
          ELIXIR,
          { id: "broken" }, // missing required fields
          { ...ELIXIR, id: "typescript" }, // collides with a built-in
        ],
      }),
      "utf8",
    );
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.list()).toEqual([ELIXIR]);
  });

  test("load tolerates a malformed file", async () => {
    await writeFile(join(tmpDir, "lsp-servers.json"), "{not json", "utf8");
    const store = new CustomLspServersStore(tmpDir);
    await store.load();
    expect(store.list()).toEqual([]);
  });
});
