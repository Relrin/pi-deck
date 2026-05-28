import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PlanFileWatcher } from "../../src/host/plan-file-watcher.js";
import { EVENT_PLAN_FILE_CHANGED } from "../../src/protocol/events.js";

let projectDir: string;

beforeEach(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "pi-deck-plan-watcher-"));
});

afterEach(async () => {
  await rm(projectDir, { recursive: true, force: true });
});

/**
 * Subscribe to the watcher and resolve when the first `plan.file.changed` event lands —
 * up to the timeout. Chokidar can take a tick on Windows to attach the OS-level watch, so
 * tests give it a generous window before bailing.
 */
function nextEvent(
  watcher: PlanFileWatcher,
  timeoutMs = 2_500,
): Promise<{ topic: string; payload: unknown }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Timed out waiting for plan.file.changed event")),
      timeoutMs,
    );
    watcher.once("event", (topic, payload) => {
      clearTimeout(timer);
      resolve({ topic, payload });
    });
  });
}

describe("PlanFileWatcher.planFilePath", () => {
  test("resolves to <projectPath>/.pi-deck/plans/<sessionId>.md", () => {
    // Pass an *absolute* path so `resolve` doesn't prepend the current working drive on
    // Windows. We only assert the relative tail because Windows / POSIX prefix differs.
    const p = PlanFileWatcher.planFilePath(projectDir, "session-1");
    expect(p.replace(/\\/g, "/")).toContain(".pi-deck/plans/session-1.md");
    expect(p.replace(/\\/g, "/").startsWith(projectDir.replace(/\\/g, "/"))).toBe(true);
  });
});

describe("PlanFileWatcher.readPlanFile", () => {
  test("returns the file content when present", async () => {
    const filePath = join(projectDir, "x.md");
    await writeFile(filePath, "hello", "utf8");
    expect(await PlanFileWatcher.readPlanFile(filePath)).toBe("hello");
  });

  test("returns null for a missing file (ENOENT)", async () => {
    const missing = join(projectDir, "nope.md");
    expect(await PlanFileWatcher.readPlanFile(missing)).toBeNull();
  });
});

describe("PlanFileWatcher.ensure", () => {
  test("emits initial state immediately even when the file does not exist", async () => {
    const watcher = new PlanFileWatcher();
    const promise = nextEvent(watcher);
    watcher.ensure("session-1", projectDir);
    const ev = await promise;
    expect(ev.topic).toBe(EVENT_PLAN_FILE_CHANGED);
    expect((ev.payload as { content: unknown }).content).toBeNull();
    await watcher.shutdown();
  });

  test("re-emits when the agent writes the plan file", async () => {
    // First create the .pi-deck/plans directory so chokidar can attach its watch immediately
    // — otherwise the test would race a `mkdir` from the agent simulation.
    const planDir = join(projectDir, ".pi-deck", "plans");
    await mkdir(planDir, { recursive: true });
    const planPath = join(planDir, "session-1.md");

    const watcher = new PlanFileWatcher();
    // Consume the initial null event so the next listener only sees the write event.
    const initial = nextEvent(watcher);
    watcher.ensure("session-1", projectDir);
    await initial;

    const updated = nextEvent(watcher);
    await writeFile(planPath, "## Plan\n- [ ] step", "utf8");
    const ev = await updated;
    expect((ev.payload as { content: string }).content).toContain("step");
    await watcher.shutdown();
  });

  test("idempotent — calling ensure twice does not double-watch", () => {
    const watcher = new PlanFileWatcher();
    watcher.ensure("session-1", projectDir);
    watcher.ensure("session-1", projectDir);
    // We can't easily introspect chokidar count, but the smoke-level guarantee is the call
    // doesn't throw and stop+shutdown still resolve cleanly.
    return watcher.shutdown();
  });

  test("stop releases the watcher for a session", async () => {
    const watcher = new PlanFileWatcher();
    watcher.ensure("session-1", projectDir);
    await watcher.stop("session-1");
    // Subsequent stops are no-ops.
    await watcher.stop("session-1");
    await watcher.shutdown();
  });
});
