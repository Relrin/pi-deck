import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { AuthBridge } from "../../src/providers/auth-bridge.js";

/**
 * `AuthBridge` is the only place pi-deck writes the user's API keys, and pi 0.85 rewrote the API
 * underneath it: `AuthStorage` left the public surface, and the sole *persisting* path became
 * `ModelRuntime.login(id, "api_key", …)` — `setRuntimeApiKey` keeps the key in memory only, so
 * reaching for it would silently lose every key on restart.
 *
 * These run against a temp `auth.json`, never the developer's own, and stay offline
 * (`allowModelNetwork: false`, `refreshOnCreate: false`). They exist to fail loudly on the next
 * pi bump rather than after a user discovers their key did not stick.
 */

let dir: string;
let authPath: string;

async function makeBridge(modelsPath?: string): Promise<AuthBridge> {
  const runtime = await ModelRuntime.create({
    authPath,
    ...(modelsPath ? { modelsPath } : {}),
    allowModelNetwork: false,
    refreshOnCreate: false,
  });
  return new AuthBridge(runtime);
}

async function storedCredentials(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(authPath, "utf8"));
  } catch {
    return {};
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "pi-deck-auth-bridge-"));
  authPath = join(dir, "auth.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("AuthBridge", () => {
  test("reports needs-key until a credential exists", async () => {
    const bridge = await makeBridge();
    expect(bridge.getAuthState("anthropic")).toBe("needs-key");
  });

  test("setApiKey persists to auth.json in the shape pi reads back", async () => {
    const bridge = await makeBridge();
    await bridge.setApiKey("anthropic", "sk-test-key");

    expect(bridge.getAuthState("anthropic")).toBe("authenticated");
    // The stored shape is what `AuthStorage.set` used to write, so an auth.json produced by an
    // older pi-deck keeps working and vice versa.
    expect((await storedCredentials()).anthropic).toEqual({
      type: "api_key",
      key: "sk-test-key",
    });
  });

  test("clearApiKey removes the credential from disk", async () => {
    const bridge = await makeBridge();
    await bridge.setApiKey("openai", "sk-test-key");
    await bridge.clearApiKey("openai");

    expect(bridge.getAuthState("openai")).toBe("needs-key");
    expect(await storedCredentials()).not.toHaveProperty("openai");
  });

  test("an empty key is refused before it reaches pi", async () => {
    const bridge = await makeBridge();
    await expect(bridge.setApiKey("anthropic", "   ")).rejects.toThrow("API key cannot be empty");
    expect(await storedCredentials()).toEqual({});
  });

  test("works for a custom OpenAI-compatible provider, not just the built-ins", async () => {
    // pi-deck writes these into models.json itself; they are the case where `login` could
    // plausibly have been unavailable, since ambient-only providers omit it.
    const modelsPath = join(dir, "models.json");
    await writeFile(
      modelsPath,
      JSON.stringify({
        providers: {
          "pi-deck-local": {
            name: "Local",
            baseUrl: "http://localhost:1234/v1",
            api: "openai-completions",
            models: [
              {
                id: "local-model",
                name: "Local Model",
                reasoning: false,
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 8192,
                maxTokens: 4096,
              },
            ],
          },
        },
      }),
    );

    const bridge = await makeBridge(modelsPath);
    await bridge.setApiKey("pi-deck-local", "sk-local");

    expect(bridge.getAuthState("pi-deck-local")).toBe("authenticated");
    expect((await storedCredentials())["pi-deck-local"]).toEqual({
      type: "api_key",
      key: "sk-local",
    });
  });
});
