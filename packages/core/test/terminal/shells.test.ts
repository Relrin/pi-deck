import { describe, expect, test } from "bun:test";
import { detectShells, resolveShell, type ShellDetectionDeps } from "../../src/terminal/shells.js";

function winDeps(overrides: Partial<ShellDetectionDeps> = {}): Partial<ShellDetectionDeps> {
  return {
    platform: "win32",
    env: {
      SystemRoot: "C:\\Windows",
      ComSpec: "C:\\Windows\\System32\\cmd.exe",
      ProgramFiles: "C:\\Program Files",
    } as NodeJS.ProcessEnv,
    isOnPath: (cmd) => cmd === "pwsh.exe",
    isExecutableFile: (p) =>
      p.includes("powershell.exe") || p.includes("\\Git\\bin\\bash.exe") || p.endsWith("cmd.exe"),
    ...overrides,
  };
}

function unixDeps(
  platform: NodeJS.Platform,
  overrides: Partial<ShellDetectionDeps> = {},
): Partial<ShellDetectionDeps> {
  return {
    platform,
    env: { SHELL: "/bin/zsh" } as NodeJS.ProcessEnv,
    isOnPath: () => false,
    isExecutableFile: (p) => ["/bin/zsh", "/bin/bash", "/bin/sh"].includes(p),
    ...overrides,
  };
}

describe("detectShells", () => {
  test("windows: lists pwsh, Windows PowerShell, Git Bash, and cmd", () => {
    const shells = detectShells(winDeps());
    const labels = shells.map((s) => s.label);
    expect(labels).toContain("PowerShell");
    expect(labels).toContain("Windows PowerShell");
    expect(labels).toContain("Git Bash");
    expect(labels).toContain("Command Prompt");
  });

  test("windows: Git Bash is detected (not mistaken for WSL) and opens as a login shell", () => {
    const gitBash = detectShells(winDeps()).find((s) => s.label === "Git Bash");
    expect(gitBash).toBeDefined();
    expect(gitBash?.path).toContain("\\Git\\bin\\bash.exe");
    expect(gitBash?.args).toEqual(["-i", "-l"]);
  });

  test("unix: env SHELL leads and dedupes against the default list", () => {
    const shells = detectShells(unixDeps("darwin"));
    expect(shells.map((s) => s.path)).toEqual(["/bin/zsh", "/bin/bash", "/bin/sh"]);
  });

  test("windows: shells carry a kind for icon mapping", () => {
    const byLabel = new Map(detectShells(winDeps()).map((s) => [s.label, s.kind]));
    expect(byLabel.get("PowerShell")).toBe("powershell");
    expect(byLabel.get("Git Bash")).toBe("gitbash");
    expect(byLabel.get("Command Prompt")).toBe("cmd");
  });

  test("windows: enumerates WSL distros as `wsl.exe -d <name>`, hiding docker distros", () => {
    const shells = detectShells(
      winDeps({
        isOnPath: (cmd) => cmd === "pwsh.exe" || cmd === "wsl.exe",
        listWslDistros: () => ["Ubuntu", "Debian", "docker-desktop", "docker-desktop-data"],
      }),
    );
    const wsl = shells.filter((s) => s.kind === "wsl");
    expect(wsl.map((s) => s.label)).toEqual(["Ubuntu (WSL)", "Debian (WSL)"]);
    expect(wsl.every((s) => s.path === "wsl.exe")).toBe(true);
    expect(wsl.find((s) => s.label === "Ubuntu (WSL)")?.args).toEqual(["-d", "Ubuntu"]);
  });

  test("windows: no WSL entries when wsl.exe is absent", () => {
    const shells = detectShells(winDeps({ listWslDistros: () => ["Ubuntu"] }));
    expect(shells.some((s) => s.kind === "wsl")).toBe(false);
  });
});

describe("resolveShell", () => {
  test("falls back to the first detected shell when no override is given", () => {
    expect(resolveShell(undefined, winDeps()).command).toBe("pwsh.exe");
    expect(resolveShell(undefined, unixDeps("darwin")).command).toBe("/bin/zsh");
  });

  test("honours a valid path-like override with its detected args", () => {
    const gitBashPath = "C:\\Program Files\\Git\\bin\\bash.exe";
    expect(resolveShell(gitBashPath, winDeps())).toEqual({
      command: gitBashPath,
      args: ["-i", "-l"],
    });
  });

  test("ignores a WSL-style bare `bash` override on Windows", () => {
    const resolved = resolveShell("bash", winDeps({ isOnPath: () => true }));
    expect(resolved.command).toBe("pwsh.exe");
  });

  test("last-resort platform fallback when nothing is available", () => {
    const none = { isExecutableFile: () => false, isOnPath: () => false };
    expect(resolveShell(undefined, { platform: "linux", ...none }).command).toBe("/bin/bash");
    expect(
      resolveShell(undefined, { platform: "win32", env: {} as NodeJS.ProcessEnv, ...none }).command,
    ).toBe("cmd.exe");
  });
});
