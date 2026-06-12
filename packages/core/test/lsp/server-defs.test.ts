import { describe, expect, test } from "bun:test";
import {
  type CustomLanguageServerDef,
  customExtensionMap,
  LANGUAGE_ID_BY_EXTENSION,
  LANGUAGE_SERVERS,
  LSP_NOTIFY_ALLOWLIST,
  LSP_REQUEST_ALLOWLIST,
  languageIdForFile,
  serverForLanguageId,
} from "../../src/lsp/server-defs.js";

describe("server definitions", () => {
  test("ids are unique and commands non-empty", () => {
    const ids = LANGUAGE_SERVERS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const def of LANGUAGE_SERVERS) {
      expect(def.command.length).toBeGreaterThan(0);
      expect(def.installHint.length).toBeGreaterThan(0);
      expect(def.languageIds.length).toBeGreaterThan(0);
    }
  });

  test("no languageId is claimed by two servers", () => {
    const seen = new Set<string>();
    for (const def of LANGUAGE_SERVERS) {
      for (const lang of def.languageIds) {
        expect(seen.has(lang)).toBe(false);
        seen.add(lang);
      }
    }
  });

  test("every mapped extension's languageId has a server", () => {
    for (const languageId of Object.values(LANGUAGE_ID_BY_EXTENSION)) {
      expect(serverForLanguageId(languageId)).not.toBeNull();
    }
  });
});

describe("languageIdForFile", () => {
  test("resolves common extensions", () => {
    expect(languageIdForFile("a.ts")).toBe("typescript");
    expect(languageIdForFile("src/App.tsx")).toBe("typescriptreact");
    expect(languageIdForFile("D:\\proj\\main.go")).toBe("go");
    expect(languageIdForFile("style.SCSS")).toBe("scss");
  });

  test("unknown / extension-less files yield null", () => {
    expect(languageIdForFile("Makefile")).toBeNull();
    expect(languageIdForFile(".gitignore")).toBeNull();
    expect(languageIdForFile("notes.txt")).toBeNull();
  });
});

const ELIXIR: CustomLanguageServerDef = {
  id: "elixir",
  label: "Elixir",
  languageIds: ["elixir", "phoenix-heex"],
  extensions: ["ex", "exs", "heex:phoenix-heex"],
  command: "elixir-ls",
  args: [],
  installHint: "install elixir-ls",
};

describe("custom server lookups", () => {
  test("bare extensions map to the first languageId; colon entries override", () => {
    expect(customExtensionMap([ELIXIR])).toEqual({
      ex: "elixir",
      exs: "elixir",
      heex: "phoenix-heex",
    });
  });

  test("languageIdForFile consults custom defs after built-ins", () => {
    expect(languageIdForFile("lib/app.ex", [ELIXIR])).toBe("elixir");
    expect(languageIdForFile("lib/page.heex", [ELIXIR])).toBe("phoenix-heex");
    expect(languageIdForFile("lib/app.ex")).toBeNull();
  });

  test("built-in extensions cannot be shadowed by a custom def", () => {
    const squatter: CustomLanguageServerDef = {
      ...ELIXIR,
      id: "squatter",
      languageIds: ["not-typescript"],
      extensions: ["ts"],
    };
    expect(languageIdForFile("a.ts", [squatter])).toBe("typescript");
  });

  test("serverForLanguageId resolves custom languageIds, built-ins first", () => {
    expect(serverForLanguageId("elixir", [ELIXIR])?.id).toBe("elixir");
    expect(serverForLanguageId("typescript", [ELIXIR])?.id).toBe("typescript");
    expect(serverForLanguageId("elixir")).toBeNull();
  });
});

describe("allowlists", () => {
  test("document sync + handshake notifications are forwardable", () => {
    for (const method of [
      "initialized",
      "exit",
      "textDocument/didOpen",
      "textDocument/didChange",
      "textDocument/didSave",
      "textDocument/didClose",
      "$/cancelRequest",
    ]) {
      expect(LSP_NOTIFY_ALLOWLIST.has(method)).toBe(true);
    }
  });

  test("editor feature requests are forwardable, arbitrary RPC is not", () => {
    for (const method of [
      "initialize",
      "shutdown",
      "textDocument/completion",
      "textDocument/hover",
      "textDocument/definition",
      "textDocument/rename",
    ]) {
      expect(LSP_REQUEST_ALLOWLIST.has(method)).toBe(true);
    }
    expect(LSP_REQUEST_ALLOWLIST.has("workspace/executeCommand")).toBe(false);
    expect(LSP_REQUEST_ALLOWLIST.has("workspace/symbol")).toBe(false);
  });
});
