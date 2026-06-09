import { describe, expect, test } from "bun:test";
import {
  deckPathToUri,
  type LspMapping,
  parseWslRoot,
  toPosixPath,
  uriToDeckPath,
} from "../../src/lsp/uri.js";

const LOCAL: LspMapping = { kind: "local" };
const WSL: LspMapping = { kind: "wsl", distro: "Ubuntu" };

describe("toPosixPath", () => {
  test("flips backslashes and trims trailing slashes", () => {
    expect(toPosixPath("D:\\Code\\proj\\")).toBe("D:/Code/proj");
    expect(toPosixPath("\\\\wsl.localhost\\Ubuntu\\home\\u")).toBe("//wsl.localhost/Ubuntu/home/u");
  });

  test("bare root survives", () => {
    expect(toPosixPath("/")).toBe("/");
  });
});

describe("parseWslRoot", () => {
  test("parses wsl.localhost UNC (native and POSIX-normalised)", () => {
    expect(parseWslRoot("\\\\wsl.localhost\\Ubuntu\\home\\u\\proj")).toEqual({
      distro: "Ubuntu",
      guestPath: "/home/u/proj",
    });
    expect(parseWslRoot("//wsl.localhost/Ubuntu/home/u/proj")).toEqual({
      distro: "Ubuntu",
      guestPath: "/home/u/proj",
    });
  });

  test("parses legacy wsl$ UNC", () => {
    expect(parseWslRoot("\\\\wsl$\\Debian\\srv")).toEqual({ distro: "Debian", guestPath: "/srv" });
  });

  test("distro root yields guestPath /", () => {
    expect(parseWslRoot("//wsl.localhost/Ubuntu")).toEqual({ distro: "Ubuntu", guestPath: "/" });
  });

  test("rejects non-WSL paths", () => {
    expect(parseWslRoot("D:/Code/proj")).toBeNull();
    expect(parseWslRoot("//fileserver/share/x")).toBeNull();
    expect(parseWslRoot("/home/u/proj")).toBeNull();
  });
});

describe("deckPathToUri", () => {
  test("windows drive path → vscode-uri form (lowercase drive, %3A)", () => {
    expect(deckPathToUri("D:/Code/proj/src/a.ts", LOCAL)).toBe("file:///d%3A/Code/proj/src/a.ts");
  });

  test("encodes spaces per segment", () => {
    expect(deckPathToUri("C:/Program Files/x.ts", LOCAL)).toBe("file:///c%3A/Program%20Files/x.ts");
  });

  test("posix path stays plain", () => {
    expect(deckPathToUri("/home/u/proj/a.ts", LOCAL)).toBe("file:///home/u/proj/a.ts");
  });

  test("wsl mapping strips the UNC prefix to the guest path", () => {
    expect(deckPathToUri("//wsl.localhost/Ubuntu/home/u/proj/a.ts", WSL)).toBe(
      "file:///home/u/proj/a.ts",
    );
  });

  test("wsl mapping rejects non-WSL paths", () => {
    expect(deckPathToUri("D:/Code/proj/a.ts", WSL)).toBeNull();
  });
});

describe("uriToDeckPath", () => {
  test("round-trips a windows path (uppercased drive)", () => {
    expect(uriToDeckPath("file:///d%3A/Code/proj/src/a.ts", LOCAL)).toBe("D:/Code/proj/src/a.ts");
  });

  test("accepts a raw-colon drive", () => {
    expect(uriToDeckPath("file:///D:/Code/proj/a.ts", LOCAL)).toBe("D:/Code/proj/a.ts");
  });

  test("decodes percent-escapes", () => {
    expect(uriToDeckPath("file:///c%3A/Program%20Files/x.ts", LOCAL)).toBe("C:/Program Files/x.ts");
  });

  test("wsl mapping reconstructs the UNC deck path", () => {
    expect(uriToDeckPath("file:///home/u/proj/a.ts", WSL)).toBe(
      "//wsl.localhost/Ubuntu/home/u/proj/a.ts",
    );
  });

  test("posix path on a local mapping", () => {
    expect(uriToDeckPath("file:///home/u/proj/a.ts", LOCAL)).toBe("/home/u/proj/a.ts");
  });

  test("non-file URIs are skipped", () => {
    expect(uriToDeckPath("untitled:Untitled-1", LOCAL)).toBeNull();
  });

  test("round-trip identity for typical paths", () => {
    for (const [path, mapping] of [
      ["D:/Code/pi-deck/packages/core/src/index.ts", LOCAL],
      ["/home/u/work/proj/main.rs", LOCAL],
      ["//wsl.localhost/Ubuntu/home/u/proj/src/app.tsx", WSL],
    ] as const) {
      const uri = deckPathToUri(path, mapping);
      expect(uri).not.toBeNull();
      expect(uriToDeckPath(uri as string, mapping)).toBe(path);
    }
  });
});
