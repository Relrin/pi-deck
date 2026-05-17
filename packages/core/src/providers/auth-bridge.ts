import type { AuthStorage } from "@earendil-works/pi-coding-agent";
import type { AuthState } from "./types.js";

/**
 * Thin facade around pi-ai's `AuthStorage`. The host owns the *only* instance of this bridge;
 * the renderer never sees raw key material. We expose two safe shapes:
 *
 *   - `getAuthState(authJsonKey)` returns one of three boolean-ish states. The renderer uses
 *     this to draw the "needs key" / "authenticated" badge in the picker.
 *   - `setApiKey` / `clearApiKey` mutate `~/.pi/agent/auth.json` via pi's API (file locking +
 *     0600 perms handled there). We do not write the JSON by hand.
 *
 * `AuthStorage` itself is constructed by the caller via a dynamic `import()` and handed in —
 * the host bundle is CommonJS and pi-coding-agent is ESM-only, so we cannot use a static
 * import here.
 */
export class AuthBridge {
  private readonly storage: AuthStorage;

  constructor(storage: AuthStorage) {
    this.storage = storage;
  }

  /**
   * Synchronous probe — does pi already have a credential configured for this provider key?
   * We use `getAuthStatus` (no token refresh) so the call is cheap and side-effect-free.
   */
  getAuthState(authJsonKey: string): AuthState {
    try {
      const status = this.storage.getAuthStatus(authJsonKey);
      return status.configured ? "authenticated" : "needs-key";
    } catch {
      return "needs-key";
    }
  }

  /** Persist an API key to `auth.json`. */
  setApiKey(authJsonKey: string, key: string): void {
    if (!key.trim()) {
      throw new Error("API key cannot be empty");
    }
    this.storage.set(authJsonKey, { type: "api_key", key });
  }

  /** Remove any credential (API key OR OAuth token) for a provider. */
  clearApiKey(authJsonKey: string): void {
    this.storage.remove(authJsonKey);
  }

  /** Underlying AuthStorage — exposed so the worker can share the same instance at spawn. */
  getStorage(): AuthStorage {
    return this.storage;
  }

  /** Best-effort live test that a key actually resolves. Returns `false` on any error. */
  async hasResolvableKey(authJsonKey: string): Promise<boolean> {
    try {
      const key = await this.storage.getApiKey(authJsonKey);
      return Boolean(key && key.length > 0);
    } catch {
      return false;
    }
  }
}
