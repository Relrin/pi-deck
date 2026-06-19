import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Secure storage for MCP bearer tokens.
 *
 * Secrets are encrypted at rest (Electron `safeStorage`, OS keychain) and never written into
 * `mcp.json` or any repo file. At worker spawn the decrypted tokens are injected into the agent
 * process as env vars; the server's config only references the var name via `bearerTokenEnv`,
 * which the adapter resolves with `process.env[...]`.
 */

export interface SecretCrypto {
  /** Whether OS-backed encryption is usable on this machine. */
  available(): boolean;
  /** Encrypt a plaintext secret to a base64 string. */
  encrypt(plain: string): string;
  /** Decrypt a base64 string produced by `encrypt`. */
  decrypt(b64: string): string;
}

let crypto: SecretCrypto | undefined;

/** Installed by the desktop bridge (electron `safeStorage`). */
export function setSecretCrypto(impl: SecretCrypto): void {
  crypto = impl;
}

/** The env var the adapter reads (`bearerTokenEnv`) for a server's token. */
export function mcpTokenEnvVar(serverName: string): string {
  return `PI_DECK_MCP_${serverName.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase()}`;
}

export class McpSecretsStore {
  private readonly file: string;
  /** server name → encrypted base64 token. */
  private tokens = new Map<string, string>();

  constructor(userDataDir: string) {
    this.file = join(userDataDir, "mcp-secrets.json");
  }

  async load(): Promise<void> {
    try {
      const parsed = JSON.parse(await readFile(this.file, "utf8"));
      const stored = (parsed as { tokens?: unknown })?.tokens;
      if (stored && typeof stored === "object") {
        for (const [name, value] of Object.entries(stored)) {
          if (typeof value === "string") this.tokens.set(name, value);
        }
      }
    } catch {
      /* no secrets yet */
    }
  }

  has(name: string): boolean {
    return this.tokens.has(name);
  }

  names(): string[] {
    return [...this.tokens.keys()];
  }

  async set(name: string, token: string): Promise<void> {
    if (!crypto?.available()) {
      throw new Error("Secure storage is unavailable on this system — cannot save the token");
    }
    this.tokens.set(name, crypto.encrypt(token));
    await this.save();
  }

  async delete(name: string): Promise<void> {
    if (this.tokens.delete(name)) await this.save();
  }

  /** Decrypted env vars for worker spawn: `{ [bearerTokenEnv]: token }`. */
  envVars(): Record<string, string> {
    const out: Record<string, string> = {};
    if (!crypto) return out;
    for (const [name, encrypted] of this.tokens) {
      try {
        out[mcpTokenEnvVar(name)] = crypto.decrypt(encrypted);
      } catch {
        /* a token that can't be decrypted (e.g. keychain reset) is skipped */
      }
    }
    return out;
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    const obj = { tokens: Object.fromEntries(this.tokens) };
    await writeFile(tmp, `${JSON.stringify(obj, null, 2)}\n`, "utf8");
    await rename(tmp, this.file);
  }
}
