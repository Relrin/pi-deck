import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Build an `Ignore` matcher seeded from a project root's `.gitignore` and
 * `.git/info/exclude`. Returns an empty matcher when neither file exists.
 *
 * The walker composes more granular per-dir `.gitignore` files on top of this one; this
 * helper is the cheap single-shot version the watcher uses to filter incoming fs events.
 */
export async function buildIgnoreFromRoot(absRoot: string): Promise<Ignore> {
  const matcher = ignore();
  const rootIgnore = await readSafe(join(absRoot, ".gitignore"));
  if (rootIgnore) matcher.add(rootIgnore);
  const infoExclude = await readSafe(join(absRoot, ".git", "info", "exclude"));
  if (infoExclude) matcher.add(infoExclude);
  return matcher;
}

async function readSafe(path: string): Promise<string | undefined> {
  try {
    const txt = await readFile(path, "utf8");
    return txt.trim().length > 0 ? txt : undefined;
  } catch {
    return undefined;
  }
}
