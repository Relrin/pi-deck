import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import {
  DefaultResourceLoader,
  getAgentDir,
  loadSkills,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { runGit } from "../git/runner.js";
import type { SessionCommandInfo, SkillInfo } from "../protocol/commands.js";

/**
 * Host-side skill management. Listing reuses pi's own discovery (`loadSkills`) so what the
 * settings panel shows is exactly what a session's system prompt will contain. Install only
 * ever writes into the **global** skills dir (`<agentDir>/skills`); uninstall is containment
 * checked against the known skill roots so a malicious `baseDir` can't escape into arbitrary
 * filesystem deletes.
 */

export interface SkillsListing {
  skills: SkillInfo[];
  diagnostics: Array<{ type: "warning" | "error" | "collision"; message: string; path?: string }>;
}

/** Directories pi-deck may delete skills from (per project). */
function skillRoots(projectPath: string | undefined, agentDir: string): string[] {
  const roots = [join(agentDir, "skills"), join(homedir(), ".agents", "skills")];
  if (projectPath) {
    roots.push(join(projectPath, ".pi", "skills"), join(projectPath, ".agents", "skills"));
  }
  return roots.map((r) => resolve(r));
}

function samePath(a: string, b: string): boolean {
  // Windows paths are case-insensitive; normalising both sides keeps the containment
  // check honest against mixed-case input from the renderer.
  const norm = (p: string) =>
    process.platform === "win32" ? resolve(p).toLowerCase() : resolve(p);
  return norm(a) === norm(b);
}

function isInside(child: string, parent: string): boolean {
  const from = process.platform === "win32" ? resolve(parent).toLowerCase() : resolve(parent);
  const to = process.platform === "win32" ? resolve(child).toLowerCase() : resolve(child);
  const rel = relative(from, to);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export function listSkills(projectPath: string, agentDir = getAgentDir()): SkillsListing {
  let skillPaths: string[] = [];
  try {
    // Settings may add extra skill dirs (e.g. ~/.claude/skills). Unreadable settings just
    // mean the default locations are scanned.
    skillPaths = SettingsManager.create(projectPath, agentDir).getSkillPaths();
  } catch {
    skillPaths = [];
  }
  const result = loadSkills({ cwd: projectPath, agentDir, skillPaths, includeDefaults: true });
  const roots = skillRoots(projectPath, agentDir);
  return {
    skills: result.skills.map((s) => ({
      name: s.name,
      description: s.description,
      filePath: s.filePath,
      baseDir: s.baseDir,
      scope: s.sourceInfo.scope,
      disableModelInvocation: s.disableModelInvocation,
      removable: roots.some(
        (root) =>
          isInside(s.baseDir, root) || (samePath(s.baseDir, root) && isInside(s.filePath, root)),
      ),
    })),
    diagnostics: result.diagnostics.map((d) => ({
      type: d.type,
      message: d.message,
      path: d.path,
    })),
  };
}

/**
 * Slash commands derivable from disk alone, for composers with no live session yet (the
 * BLANK screen). Covers prompt templates + skills via pi's own loader, with extensions
 * disabled — extension commands only exist inside a running session and never execute
 * host-side. Ordering mirrors pi's `getCommands()`: templates before skills.
 */
export async function listProjectCommands(
  projectPath: string,
  agentDir = getAgentDir(),
): Promise<SessionCommandInfo[]> {
  let settingsManager: SettingsManager | undefined;
  try {
    settingsManager = SettingsManager.create(projectPath, agentDir);
  } catch {
    settingsManager = undefined;
  }
  const loader = new DefaultResourceLoader({
    cwd: projectPath,
    agentDir,
    ...(settingsManager ? { settingsManager } : {}),
    noExtensions: true,
    noThemes: true,
    noContextFiles: true,
  });
  await loader.reload();
  const templates = loader.getPrompts().prompts.map((t) => ({
    name: t.name,
    description: t.description,
    source: "prompt" as const,
    sourcePath: t.filePath,
  }));
  const skills = loader.getSkills().skills.map((s) => ({
    name: `skill:${s.name}`,
    description: s.description,
    source: "skill" as const,
    sourcePath: s.filePath,
  }));
  return [...templates, ...skills];
}

/** `https://github.com/foo/bar.git` / `git@host:foo/bar` → `bar`. */
export function repoDirName(url: string): string | null {
  const tail = url
    .replace(/[/\\]+$/, "")
    .split(/[/\\:]/)
    .pop();
  if (!tail) return null;
  const name = tail.replace(/\.git$/i, "").trim();
  return /^[\w.-]+$/.test(name) && name !== "." && name !== ".." ? name : null;
}

async function ensureAbsent(target: string): Promise<void> {
  const existing = await stat(target).catch(() => null);
  if (existing) {
    throw new Error(`${basename(target)} already exists in the skills directory — remove it first`);
  }
}

export async function installSkillFromGit(url: string, agentDir = getAgentDir()): Promise<string> {
  const name = repoDirName(url);
  if (!name) throw new Error("Could not derive a folder name from the repository URL");
  const skillsDir = join(agentDir, "skills");
  await mkdir(skillsDir, { recursive: true });
  const target = join(skillsDir, name);
  await ensureAbsent(target);
  await runGit(skillsDir, ["clone", "--depth", "1", url, name], {
    timeoutMs: 120_000,
    detectNotARepo: false,
  });
  return target;
}

export async function installSkillFromFolder(
  srcPath: string,
  agentDir = getAgentDir(),
): Promise<string> {
  const src = resolve(srcPath);
  const st = await stat(src).catch(() => null);
  if (!st?.isDirectory()) throw new Error("Selected path is not a folder");
  const entries = await readdir(src);
  const looksLikeSkills = entries.some((e) => {
    const lower = e.toLowerCase();
    return lower === "skill.md" || lower.endsWith(".md");
  });
  if (!looksLikeSkills) {
    throw new Error(
      "Folder doesn't look like a skill: expected a SKILL.md (or .md files) at its root",
    );
  }
  const skillsDir = join(agentDir, "skills");
  await mkdir(skillsDir, { recursive: true });
  const target = join(skillsDir, basename(src));
  if (samePath(src, target) || isInside(target, src)) {
    throw new Error("Folder is already inside the skills directory");
  }
  await ensureAbsent(target);
  await cp(src, target, { recursive: true });
  return target;
}

/**
 * Delete an installed skill. Directory skills (`baseDir` strictly inside a root) are removed
 * wholesale; root-level single-file skills (`baseDir` *is* a root) only lose their `.md` file
 * — deleting the root would take every sibling skill with it.
 */
export async function uninstallSkill(
  args: { filePath: string; baseDir: string },
  projectPath: string | undefined,
  agentDir = getAgentDir(),
): Promise<void> {
  const roots = skillRoots(projectPath, agentDir);
  const base = resolve(args.baseDir);
  const file = resolve(args.filePath);

  if (roots.some((root) => samePath(base, root))) {
    if (!isInside(file, base)) {
      throw new Error("Refusing to delete a file outside the skill directory");
    }
    await rm(file, { force: true });
    return;
  }
  if (!roots.some((root) => isInside(base, root))) {
    throw new Error("Refusing to delete a folder outside the known skill directories");
  }
  await rm(base, { recursive: true, force: true });
}
