import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionInfo as PiSessionInfo } from "@earendil-works/pi-coding-agent";
import { MetadataStore } from "../../src/host/metadata-store.js";
import { SessionManager } from "../../src/host/session-manager.js";

let tmpDir: string;
let store: MetadataStore;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-discovery-"));
  store = new MetadataStore(tmpDir);
  await store.ensure();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

function makePiSession(overrides: Partial<PiSessionInfo> = {}): PiSessionInfo {
  return {
    path: "/.pi/agent/sessions/foo/abc.jsonl",
    id: "pi-session-abc",
    cwd: "/work/foo",
    created: new Date("2026-05-01T10:00:00Z"),
    modified: new Date("2026-05-10T10:00:00Z"),
    messageCount: 4,
    firstMessage: "Look at the diff and write a commit message",
    allMessagesText: "",
    ...overrides,
  };
}

function makeManager(listPiSessions: (cwd: string) => Promise<PiSessionInfo[]>) {
  // Worker spawning is irrelevant for discovery — pass a stub that throws if anyone actually
  // tries to use it. The rehydrate path only touches metadata and the lister.
  const spawnWorker = () => {
    throw new Error("worker should not be spawned during discovery");
  };
  return new SessionManager({
    spawnWorker: spawnWorker as never,
    metadataStore: store,
    listPiSessions,
  });
}

describe("SessionManager.rehydrateProject — pi session discovery", () => {
  test("adopts pi sessions that pi-deck hasn't claimed yet", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    const discovered = makePiSession();
    const mgr = makeManager(async () => [discovered]);

    await mgr.rehydrateProject(project.id);

    const list = mgr.list(project.id);
    expect(list.length).toBe(1);
    expect(list[0]?.id).toBe("pi-session-abc");
    expect(list[0]?.sessionFile).toBe(discovered.path);
    expect(list[0]?.title).toBe("Look at the diff and write a commit message");
    expect(list[0]?.lastActivityAt).toBe(discovered.modified.toISOString());
  });

  test("branch falls back to undefined when the project path isn't a git repo", async () => {
    // /work/foo doesn't exist on the filesystem, so `currentBranch` rejects and discovery
    // leaves the field empty rather than throwing. The rail simply omits the branch line.
    const project = await store.openOrCreateProject("/work/foo");
    const mgr = makeManager(async () => [makePiSession()]);
    await mgr.rehydrateProject(project.id);
    expect(mgr.list(project.id)[0]?.branch).toBeUndefined();
  });

  test("persists adopted sessions into the project's metadata for next launch", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    const mgr = makeManager(async () => [makePiSession()]);
    await mgr.rehydrateProject(project.id);

    const reread = await store.readProject(project.id);
    expect(reread?.sessionIds).toContain("pi-session-abc");
    expect(reread?.sessions?.["pi-session-abc"]?.title).toBe(
      "Look at the diff and write a commit message",
    );
  });

  test("does not duplicate sessions pi-deck already knows about", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    // Pre-seed pi-deck metadata with the same id pi will report.
    await store.upsertSession(project.id, {
      id: "pi-session-abc",
      title: "Existing pi-deck title",
      createdAt: "2026-04-01T10:00:00Z",
      lastActivityAt: "2026-04-05T10:00:00Z",
      archived: false,
    });

    const mgr = makeManager(async () => [makePiSession()]);
    await mgr.rehydrateProject(project.id);

    const list = mgr.list(project.id);
    expect(list.length).toBe(1);
    // The pre-existing pi-deck title wins — discovery shouldn't overwrite a title the user
    // may have renamed in-app.
    expect(list[0]?.title).toBe("Existing pi-deck title");
  });

  test("falls back to a generic title when pi has neither a name nor a first message", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    const mgr = makeManager(async () => [makePiSession({ firstMessage: "", name: undefined })]);
    await mgr.rehydrateProject(project.id);
    expect(mgr.list(project.id)[0]?.title).toBe("Untitled session");
  });

  test("prefers pi's stored display name over the first-message fallback", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    const mgr = makeManager(async () => [
      makePiSession({
        name: "Auth refactor",
        firstMessage: "this should not be used because name is set",
      }),
    ]);
    await mgr.rehydrateProject(project.id);
    expect(mgr.list(project.id)[0]?.title).toBe("Auth refactor");
  });

  test("truncates very long first messages and collapses whitespace", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    const long = `aaa\nbbb   ccc${" d".repeat(100)}`;
    const mgr = makeManager(async () => [makePiSession({ firstMessage: long, name: undefined })]);
    await mgr.rehydrateProject(project.id);
    const title = mgr.list(project.id)[0]?.title ?? "";
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
    // Newlines and runs of whitespace flatten to a single space.
    expect(title.startsWith("aaa bbb ccc")).toBe(true);
  });

  test("a throwing lister leaves the host healthy and pi-deck sessions intact", async () => {
    const project = await store.openOrCreateProject("/work/foo");
    await store.upsertSession(project.id, {
      id: "pi-deck-only",
      title: "From pi-deck",
      createdAt: "2026-05-01T10:00:00Z",
      lastActivityAt: "2026-05-01T10:00:00Z",
      archived: false,
    });

    const mgr = makeManager(async () => {
      throw new Error("pi session dir missing");
    });
    // Should not throw.
    await mgr.rehydrateProject(project.id);
    expect(mgr.list(project.id).map((s) => s.id)).toEqual(["pi-deck-only"]);
  });
});
