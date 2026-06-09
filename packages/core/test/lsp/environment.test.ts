import { describe, expect, test } from "bun:test";
import {
  buildServerLaunch,
  detectServer,
  environmentForRoot,
  type LspDetectionDeps,
} from "../../src/lsp/environment.js";
import { type LanguageServerDef, serverById } from "../../src/lsp/server-defs.js";

const TS = serverById("typescript") as LanguageServerDef;
const RUST = serverById("rust") as LanguageServerDef;

function winDeps(overrides: Partial<LspDetectionDeps> = {}): Partial<LspDetectionDeps> {
  return {
    platform: "win32",
    env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" } as NodeJS.ProcessEnv,
    whichLocal: async () => null,
    existsInWsl: async () => false,
    ...overrides,
  };
}

describe("environmentForRoot", () => {
  test("local windows root", () => {
    const env = environmentForRoot("D:\\Code\\proj");
    expect(env).toEqual({
      mapping: { kind: "local" },
      deckRoot: "D:/Code/proj",
      rootUri: "file:///d%3A/Code/proj",
    });
  });

  test("local posix root", () => {
    const env = environmentForRoot("/home/u/proj");
    expect(env).toEqual({
      mapping: { kind: "local" },
      deckRoot: "/home/u/proj",
      rootUri: "file:///home/u/proj",
    });
  });

  test("wsl root maps into the guest", () => {
    const env = environmentForRoot("\\\\wsl.localhost\\Ubuntu\\home\\u\\proj");
    expect(env).toEqual({
      mapping: { kind: "wsl", distro: "Ubuntu" },
      deckRoot: "//wsl.localhost/Ubuntu/home/u/proj",
      rootUri: "file:///home/u/proj",
    });
  });
});

describe("detectServer", () => {
  test("local: resolves via whichLocal", async () => {
    const result = await detectServer(
      RUST,
      { kind: "local" },
      winDeps({
        whichLocal: async (cmd) => (cmd === "rust-analyzer" ? "C:\\bin\\rust-analyzer.exe" : null),
      }),
    );
    expect(result).toEqual({ available: true, resolvedCommand: "C:\\bin\\rust-analyzer.exe" });
  });

  test("local: missing command", async () => {
    const result = await detectServer(RUST, { kind: "local" }, winDeps());
    expect(result).toEqual({ available: false, resolvedCommand: null });
  });

  test("wsl: defers to existsInWsl with the distro", async () => {
    const seen: string[] = [];
    const result = await detectServer(
      TS,
      { kind: "wsl", distro: "Ubuntu" },
      winDeps({
        existsInWsl: async (distro, cmd) => {
          seen.push(`${distro}:${cmd}`);
          return true;
        },
      }),
    );
    expect(result.available).toBe(true);
    expect(seen).toEqual(["Ubuntu:typescript-language-server"]);
  });
});

describe("buildServerLaunch", () => {
  test("missing server yields null", async () => {
    expect(await buildServerLaunch(RUST, { kind: "local" }, winDeps())).toBeNull();
  });

  test("plain executable launches directly", async () => {
    const launch = await buildServerLaunch(
      RUST,
      { kind: "local" },
      winDeps({ whichLocal: async () => "C:\\bin\\rust-analyzer.exe" }),
    );
    expect(launch).toEqual({ command: "C:\\bin\\rust-analyzer.exe", args: [] });
  });

  test("windows cmd shim goes through cmd /d /s /c with verbatim args", async () => {
    const launch = await buildServerLaunch(
      TS,
      { kind: "local" },
      winDeps({
        whichLocal: async () =>
          "C:\\Users\\u\\AppData\\Roaming\\npm\\typescript-language-server.CMD",
      }),
    );
    expect(launch).toEqual({
      command: "C:\\Windows\\System32\\cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        '""C:\\Users\\u\\AppData\\Roaming\\npm\\typescript-language-server.CMD" --stdio"',
      ],
      windowsVerbatimArguments: true,
    });
  });

  test("posix command launches by resolved path", async () => {
    const launch = await buildServerLaunch(
      TS,
      { kind: "local" },
      {
        platform: "linux",
        env: {} as NodeJS.ProcessEnv,
        whichLocal: async () => "/usr/local/bin/typescript-language-server",
        existsInWsl: async () => false,
      },
    );
    expect(launch).toEqual({
      command: "/usr/local/bin/typescript-language-server",
      args: ["--stdio"],
    });
  });

  test("wsl launch wraps in a login shell exec", async () => {
    const launch = await buildServerLaunch(
      TS,
      { kind: "wsl", distro: "Ubuntu" },
      winDeps({ existsInWsl: async () => true }),
    );
    expect(launch).toEqual({
      command: "wsl.exe",
      args: ["-d", "Ubuntu", "--", "sh", "-lc", "exec typescript-language-server --stdio"],
    });
  });
});
