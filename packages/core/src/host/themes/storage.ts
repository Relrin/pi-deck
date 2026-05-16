import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** File-system layout for theme storage under the Electron `userData` dir. */
export class ThemeStorage {
  readonly themesDir: string;
  private readonly activeFile: string;

  constructor(userDataDir: string) {
    this.themesDir = join(userDataDir, "themes");
    this.activeFile = join(userDataDir, "active-theme.txt");
  }

  async ensure(): Promise<void> {
    await mkdir(this.themesDir, { recursive: true });
  }

  async readActive(): Promise<string | null> {
    try {
      const raw = await readFile(this.activeFile, "utf8");
      const name = raw.trim();
      return name.length > 0 ? name : null;
    } catch {
      return null;
    }
  }

  async writeActive(name: string): Promise<void> {
    await writeFile(this.activeFile, `${name}\n`, "utf8");
  }
}
