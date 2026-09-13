import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { AuthState } from "./types.js";

/**
 * Thin facade around pi's `ModelRuntime` for credential work. The host owns the *only* instance;
 * the renderer never sees raw key material. We expose three safe shapes:
 *
 *   - `getAuthState(providerId)` returns one of three boolean-ish states. The renderer uses this
 *     to draw the "needs key" / "authenticated" badge in the picker. Still synchronous, which is
 *     what keeps `ProviderRegistry.listProviders()` synchronous.
 *   - `setApiKey` / `clearApiKey` mutate `~/.pi/agent/auth.json` via pi's API (file locking +
 *     0600 perms handled there). We do not write the JSON by hand.
 *
 * `ModelRuntime` is constructed by the caller via a dynamic `import()` and handed in — the host
 * bundle is CommonJS and pi-coding-agent is ESM-only, so we cannot use a static import here.
 *
 * Note pi keys credentials by `Provider.id`. `authJsonKey` in our own provider definitions is
 * exactly that id ("anthropic", "openai", …, and a custom provider's own id), so the two are
 * interchangeable and no mapping table is needed.
 */
export class AuthBridge {
  private readonly runtime: ModelRuntime;

  constructor(runtime: ModelRuntime) {
    this.runtime = runtime;
  }

  /**
   * Synchronous probe — does pi already have a credential configured for this provider?
   *
   * `getProviderAuthStatus` reads the composed snapshot rather than the credential file, so it is
   * cheap, side-effect-free, and (unlike the raw file read this replaced) also sees keys supplied
   * through the environment or models.json.
   */
  getAuthState(providerId: string): AuthState {
    try {
      return this.runtime.getProviderAuthStatus(providerId).configured
        ? "authenticated"
        : "needs-key";
    } catch {
      return "needs-key";
    }
  }

  /**
   * Persist an API key to `auth.json`.
   *
   * `login(…, "api_key", …)` is the only public path that *persists*: `setRuntimeApiKey` keeps the
   * key in memory for the life of the process, so a key set through it would vanish on restart.
   * The provider's own login implementation drives the prompts, which for the usual "paste your
   * key" providers is a single one — the guard below makes a provider that wants more than that
   * fail loudly rather than have the same string stored into every field it asked for.
   */
  async setApiKey(providerId: string, key: string): Promise<void> {
    if (!key.trim()) {
      throw new Error("API key cannot be empty");
    }
    let answered = false;
    await this.runtime.login(providerId, "api_key", {
      prompt: async () => {
        if (answered) {
          throw new Error(
            `${providerId} needs more than an API key to authenticate — configure it with the pi CLI.`,
          );
        }
        answered = true;
        return key;
      },
      notify: () => {},
    });
  }

  /** Remove any credential (API key OR OAuth token) for a provider. */
  async clearApiKey(providerId: string): Promise<void> {
    await this.runtime.logout(providerId);
  }

  /** Best-effort live test that a credential actually resolves. Returns `false` on any error. */
  async hasResolvableKey(providerId: string): Promise<boolean> {
    try {
      return Boolean(await this.runtime.getAuth(providerId));
    } catch {
      return false;
    }
  }
}
