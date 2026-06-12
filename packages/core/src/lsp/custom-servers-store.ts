import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { type CustomLspServer, CustomLspServerSchema } from "../protocol/lsp.js";
import { type CustomLanguageServerDef, LANGUAGE_SERVERS, serverById } from "./server-defs.js";

/**
 * Persistence for user-defined language servers: a single JSON file in the host's userData
 * dir, validated entry-by-entry on load (one bad entry is skipped, not fatal) and written
 * atomically via tmp + rename, mirroring MetadataStore. The in-memory list is the source of
 * truth between loads; callers re-feed `toDefs()` into the LanguageServerManager after
 * every mutation.
 */
export class CustomLspServersStore {
  private readonly file: string;
  private servers: CustomLspServer[] = [];

  constructor(userDataDir: string) {
    this.file = join(userDataDir, "lsp-servers.json");
  }

  async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.file, "utf8");
    } catch {
      this.servers = [];
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      process.stderr.write(`[lsp] ignoring malformed ${this.file}: ${(err as Error).message}\n`);
      this.servers = [];
      return;
    }
    const list = (parsed as { servers?: unknown })?.servers;
    const out: CustomLspServer[] = [];
    if (Array.isArray(list)) {
      for (const entry of list) {
        const result = CustomLspServerSchema.safeParse(entry);
        if (result.success && !serverById(result.data.id)) {
          out.push(result.data);
        } else if (!result.success) {
          process.stderr.write(`[lsp] skipping invalid custom server entry in ${this.file}\n`);
        }
      }
    }
    this.servers = out;
  }

  list(): CustomLspServer[] {
    return this.servers.map((s) => ({ ...s }));
  }

  /** The stored entries in the manager's vocabulary (installHint always a string). */
  toDefs(): CustomLanguageServerDef[] {
    return this.servers.map((s) => ({
      id: s.id,
      label: s.label,
      languageIds: [...s.languageIds],
      extensions: [...s.extensions],
      command: s.command,
      args: [...s.args],
      installHint: s.installHint ?? "",
    }));
  }

  /** Add or replace (by id). Throws on schema violations or built-in id collisions. */
  async upsert(server: CustomLspServer): Promise<CustomLspServer[]> {
    const parsed = CustomLspServerSchema.parse(server);
    if (LANGUAGE_SERVERS.some((d) => d.id === parsed.id)) {
      throw new Error(`"${parsed.id}" is a built-in server id — pick another id`);
    }
    // `ext:languageId` overrides must reference a languageId the server actually declares,
    // otherwise didOpen would route to a languageId no server claims.
    for (const raw of parsed.extensions) {
      const colon = raw.indexOf(":");
      if (colon === -1) continue;
      const languageId = raw.slice(colon + 1).trim();
      if (!parsed.languageIds.includes(languageId)) {
        throw new Error(
          `Extension mapping "${raw}" points at "${languageId}", which is not in the server's languageIds`,
        );
      }
    }
    const idx = this.servers.findIndex((s) => s.id === parsed.id);
    if (idx === -1) this.servers.push(parsed);
    else this.servers[idx] = parsed;
    await this.save();
    return this.list();
  }

  async delete(id: string): Promise<CustomLspServer[]> {
    this.servers = this.servers.filter((s) => s.id !== id);
    await this.save();
    return this.list();
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await writeFile(tmp, `${JSON.stringify({ servers: this.servers }, null, 2)}\n`, "utf8");
    await rename(tmp, this.file);
  }
}
