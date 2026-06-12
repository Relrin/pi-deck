import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installSkillFromFolder,
  listSkills,
  repoDirName,
  uninstallSkill,
} from "../../src/host/skills.js";

let tmpDir: string;
let agentDir: string;
let projectDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), "pi-deck-skills-"));
  agentDir = join(tmpDir, "agent");
  projectDir = join(tmpDir, "project");
  await mkdir(join(agentDir, "skills"), { recursive: true });
  await mkdir(projectDir, { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeSkill(dir: string, name: string): Promise<string> {
  const skillDir = join(dir, name);
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: Test skill ${name} for unit tests.\n---\n\n# ${name}\n`,
    "utf8",
  );
  return skillDir;
}

describe("repoDirName", () => {
  test("derives folder names from common git URL shapes", () => {
    expect(repoDirName("https://github.com/anthropics/skills.git")).toBe("skills");
    expect(repoDirName("https://github.com/anthropics/skills")).toBe("skills");
    expect(repoDirName("git@github.com:badlogic/pi-skills.git")).toBe("pi-skills");
  });

  test("rejects names that would escape or be empty", () => {
    expect(repoDirName("///")).toBeNull();
    expect(repoDirName("..")).toBeNull();
  });
});

describe("listSkills", () => {
  test("finds global and project skills and marks them removable", async () => {
    await writeSkill(join(agentDir, "skills"), "global-skill");
    await writeSkill(join(projectDir, ".pi", "skills"), "project-skill");

    const listing = listSkills(projectDir, agentDir);
    const global = listing.skills.find((s) => s.name === "global-skill");
    const project = listing.skills.find((s) => s.name === "project-skill");

    expect(global).toBeDefined();
    expect(global?.scope).toBe("user");
    expect(global?.removable).toBe(true);
    expect(project).toBeDefined();
    expect(project?.scope).toBe("project");
    expect(project?.removable).toBe(true);
  });
});

describe("installSkillFromFolder", () => {
  test("copies a skill folder into the global skills dir", async () => {
    const src = await writeSkill(tmpDir, "my-skill");
    const installed = await installSkillFromFolder(src, agentDir);
    expect(installed).toBe(join(agentDir, "skills", "my-skill"));
    const st = await stat(join(installed, "SKILL.md"));
    expect(st.isFile()).toBe(true);
  });

  test("rejects folders without markdown content", async () => {
    const src = join(tmpDir, "not-a-skill");
    await mkdir(src, { recursive: true });
    await writeFile(join(src, "data.bin"), "x", "utf8");
    expect(installSkillFromFolder(src, agentDir)).rejects.toThrow(/SKILL.md/);
  });

  test("refuses to overwrite an existing install", async () => {
    const src = await writeSkill(tmpDir, "dup-skill");
    await installSkillFromFolder(src, agentDir);
    expect(installSkillFromFolder(src, agentDir)).rejects.toThrow(/already exists/);
  });
});

describe("uninstallSkill", () => {
  test("removes a directory skill inside the global root", async () => {
    const dir = await writeSkill(join(agentDir, "skills"), "doomed");
    await uninstallSkill({ filePath: join(dir, "SKILL.md"), baseDir: dir }, projectDir, agentDir);
    expect(await stat(dir).catch(() => null)).toBeNull();
  });

  test("a root-level single-file skill loses only its markdown file", async () => {
    const root = join(agentDir, "skills");
    const file = join(root, "loose-skill.md");
    await writeFile(file, "---\nname: loose\ndescription: d\n---\n", "utf8");
    const sibling = await writeSkill(root, "sibling");

    await uninstallSkill({ filePath: file, baseDir: root }, projectDir, agentDir);

    expect(await stat(file).catch(() => null)).toBeNull();
    expect(await stat(sibling).catch(() => null)).not.toBeNull();
    expect(await stat(root).catch(() => null)).not.toBeNull();
  });

  test("refuses paths outside the known skill roots", async () => {
    const outside = join(tmpDir, "precious");
    await mkdir(outside, { recursive: true });
    expect(
      uninstallSkill(
        { filePath: join(outside, "SKILL.md"), baseDir: outside },
        projectDir,
        agentDir,
      ),
    ).rejects.toThrow(/outside/);
    expect(await stat(outside).catch(() => null)).not.toBeNull();
  });

  test("refuses traversal out of a root via dotted segments", async () => {
    const sneaky = join(agentDir, "skills", "..", "..", "victim");
    await mkdir(join(tmpDir, "victim"), { recursive: true });
    expect(
      uninstallSkill({ filePath: join(sneaky, "SKILL.md"), baseDir: sneaky }, projectDir, agentDir),
    ).rejects.toThrow(/outside/);
  });
});
