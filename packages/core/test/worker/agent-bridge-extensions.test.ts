import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DefaultResourceLoader,
  type ExtensionAPI,
  type ExtensionFactory,
  getAgentDir,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";

/**
 * Pi 0.74's `createAgentSession` only auto-calls `resourceLoader.reload()` on a loader it
 * constructs itself. When we pass our own loader (so we can register inline extension
 * factories), we must call `reload()` ourselves — otherwise the factories never run and
 * `pi.on("input", ...)` / `pi.on("tool_call", ...)` go nowhere.
 *
 * This test exercises the real pi loader end-to-end so any future refactor that drops the
 * `reload()` call (or any pi version that changes the contract) trips immediately.
 */
describe("DefaultResourceLoader.reload() invokes inline extension factories", () => {
  let projectPath: string;

  beforeEach(async () => {
    projectPath = await mkdtemp(join(tmpdir(), "pideck-loader-reload-"));
  });

  afterEach(async () => {
    await rm(projectPath, { recursive: true, force: true });
  });

  test("factory runs after reload(); does NOT run before reload()", async () => {
    let factoryCallCount = 0;
    let inputHandlerRegistered = false;
    const factory: ExtensionFactory = (pi: ExtensionAPI) => {
      factoryCallCount += 1;
      pi.on("input", async () => {
        inputHandlerRegistered = true;
        return { action: "continue" };
      });
    };

    const agentDir = getAgentDir();
    const loader = new DefaultResourceLoader({
      cwd: projectPath,
      agentDir,
      settingsManager: SettingsManager.create(projectPath, agentDir),
      extensionFactories: [factory],
    });

    // Before reload(), the factory has not been invoked.
    expect(factoryCallCount).toBe(0);

    await loader.reload();

    // After reload(), the factory ran exactly once and registered its input handler.
    expect(factoryCallCount).toBe(1);
    expect(inputHandlerRegistered).toBe(false); // not yet — handler is only run on emit
    const extensions = loader.getExtensions().extensions;
    const inlineExt = extensions.find((e) => e.path.startsWith("<inline"));
    expect(inlineExt).toBeDefined();
    expect(inlineExt?.handlers.has("input")).toBe(true);
  });
});
