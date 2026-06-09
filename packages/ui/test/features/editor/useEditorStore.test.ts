import { beforeEach, describe, expect, mock, test } from "bun:test";
import { useNotificationStore } from "../../../src/features/_status/useNotificationStore";
import { useEditorStore } from "../../../src/features/editor/useEditorStore";
import { useSessionsStore } from "../../../src/features/sessions/useSessionsStore";

function mockClient(handlers: Record<string, (input: unknown) => unknown>) {
  return {
    call: mock(async (method: string, input: unknown) => {
      const fn = handlers[method];
      if (!fn) throw new Error(`Unmocked method: ${method}`);
      return fn(input);
    }),
  };
}

const readFileOk =
  (content: string, eol: "lf" | "crlf" = "lf", encoding = "utf-8") =>
  () => ({
    content,
    eol,
    encoding,
    binary: false,
    tooLarge: false,
    sizeBytes: content.length,
  });

/** Let the fire-and-forget loadTab microtask chain settle. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

beforeEach(() => {
  useEditorStore.setState({ byProject: {}, tabs: {} });
  useSessionsStore.setState({ client: undefined } as never);
  useNotificationStore.setState({ notifications: [] });
});

describe("useEditorStore.openFile", () => {
  test("loads content + HEAD baseline and marks the tab ready", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk("a\nb\n"),
        "git.fileBaseline": () => ({ content: "a\n" }),
      }) as never,
    });

    useEditorStore.getState().openFile({
      projectId: "p1",
      absPath: "/proj/src/a.ts",
      relPath: "src/a.ts",
    });
    const id = "p1:/proj/src/a.ts";
    expect(useEditorStore.getState().byProject.p1?.activeTabId).toBe(id);
    expect(useEditorStore.getState().tabs[id]?.status).toBe("loading");

    await flush();
    const tab = useEditorStore.getState().tabs[id];
    expect(tab?.status).toBe("ready");
    expect(tab?.content).toBe("a\nb\n");
    expect(tab?.baseline).toBe("a\n");
    expect(tab?.fileName).toBe("a.ts");
    expect(tab?.languageLabel).toBe("TypeScript");
  });

  test("re-opening focuses the existing tab without duplicating it", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk(""),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    const args = { projectId: "p1", absPath: "/proj/a.ts", relPath: "a.ts" };
    useEditorStore.getState().openFile(args);
    await flush();
    useEditorStore.getState().openFile(args);
    expect(useEditorStore.getState().byProject.p1?.order).toEqual(["p1:/proj/a.ts"]);
  });

  test("collapses to one tab when the same file is opened with different path separators", async () => {
    // The file tree opens with the native (backslash) project root; the git panel opens with
    // git's POSIX repo root. Both must resolve to a single tab.
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk(""),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    // File-tree style: native root + POSIX remainder (mixed separators).
    useEditorStore
      .getState()
      .openFile({ projectId: "p1", absPath: "D:\\Code\\proj/src/a.ts", relPath: "src/a.ts" });
    await flush();
    // Git-panel style: fully POSIX.
    useEditorStore
      .getState()
      .openFile({ projectId: "p1", absPath: "D:/Code/proj/src/a.ts", relPath: "src/a.ts" });

    const order = useEditorStore.getState().byProject.p1?.order ?? [];
    expect(order).toEqual(["p1:D:/Code/proj/src/a.ts"]);
    expect(useEditorStore.getState().tabs[order[0] as string]?.absPath).toBe(
      "D:/Code/proj/src/a.ts",
    );
  });

  test("binary files open read-only and blocked", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": () => ({
          content: "",
          eol: "lf",
          encoding: "utf-8",
          binary: true,
          tooLarge: false,
          sizeBytes: 9,
        }),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    useEditorStore
      .getState()
      .openFile({ projectId: "p1", absPath: "/proj/x.png", relPath: "x.png" });
    await flush();
    const tab = useEditorStore.getState().tabs["p1:/proj/x.png"];
    expect(tab?.readOnly).toBe(true);
    expect(tab?.blocked).toBe("binary");
  });
});

describe("useEditorStore.saveTab", () => {
  test("writes content with the tab's EOL and clears dirty", async () => {
    const writes: unknown[] = [];
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk("a", "crlf"),
        "git.fileBaseline": () => ({ content: null }),
        "fs.writeFile": (input) => {
          writes.push(input);
          return { ok: true };
        },
      }) as never,
    });
    useEditorStore.getState().openFile({ projectId: "p1", absPath: "/proj/a.ts", relPath: "a.ts" });
    await flush();
    const id = "p1:/proj/a.ts";
    useEditorStore.getState().setDirty(id, true);

    const ok = await useEditorStore.getState().saveTab(id, "a changed");
    expect(ok).toBe(true);
    expect(writes[0]).toEqual({
      projectId: "p1",
      path: "/proj/a.ts",
      content: "a changed",
      eol: "crlf",
      encoding: "utf-8",
      bom: false,
    });
    expect(useEditorStore.getState().tabs[id]?.dirty).toBe(false);
    expect(useEditorStore.getState().tabs[id]?.content).toBe("a changed");
  });
});

describe("useEditorStore.closeTab", () => {
  test("closing the active tab activates the tab that slid into its slot", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk(""),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    const open = (n: string) =>
      useEditorStore.getState().openFile({ projectId: "p1", absPath: `/proj/${n}`, relPath: n });
    open("a.ts");
    open("b.ts");
    open("c.ts");
    await flush();

    useEditorStore.getState().setActive("p1:/proj/b.ts");
    useEditorStore.getState().closeTab("p1:/proj/b.ts");

    expect(useEditorStore.getState().byProject.p1?.order).toEqual([
      "p1:/proj/a.ts",
      "p1:/proj/c.ts",
    ]);
    expect(useEditorStore.getState().byProject.p1?.activeTabId).toBe("p1:/proj/c.ts");
  });
});

describe("useEditorStore.setEol / setBom", () => {
  test("setEol changes the ending and marks the tab dirty", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk("a\nb\n", "lf"),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    useEditorStore.getState().openFile({ projectId: "p1", absPath: "/proj/a.ts", relPath: "a.ts" });
    await flush();
    const id = "p1:/proj/a.ts";
    expect(useEditorStore.getState().tabs[id]?.dirty).toBe(false);

    useEditorStore.getState().setEol(id, "crlf");
    expect(useEditorStore.getState().tabs[id]?.eol).toBe("crlf");
    expect(useEditorStore.getState().tabs[id]?.dirty).toBe(true);
  });

  test("setBom toggles the BOM flag and marks dirty", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk("x"),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    useEditorStore.getState().openFile({ projectId: "p1", absPath: "/proj/a.ts", relPath: "a.ts" });
    await flush();
    const id = "p1:/proj/a.ts";

    useEditorStore.getState().setBom(id, true);
    expect(useEditorStore.getState().tabs[id]?.bom).toBe(true);
    expect(useEditorStore.getState().tabs[id]?.dirty).toBe(true);
  });
});

describe("useEditorStore.setEncoding", () => {
  test("reopens the file decoded with the new encoding and bumps reloadToken", async () => {
    const reads: unknown[] = [];
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": (input) => {
          reads.push(input);
          const enc = (input as { encoding?: string }).encoding ?? "utf-8";
          // Stand-in for a real re-decode: the content differs per requested encoding.
          return {
            content: enc === "win1252" ? "café" : "cafÃ©",
            eol: "lf" as const,
            encoding: enc,
            binary: false,
            tooLarge: false,
            sizeBytes: 4,
          };
        },
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    useEditorStore
      .getState()
      .openFile({ projectId: "p1", absPath: "/proj/a.txt", relPath: "a.txt" });
    await flush();
    const id = "p1:/proj/a.txt";
    const tokenBefore = useEditorStore.getState().tabs[id]?.reloadToken ?? 0;
    expect(useEditorStore.getState().tabs[id]?.content).toBe("cafÃ©");

    useEditorStore.getState().setEncoding(id, "win1252");
    await flush();

    const tab = useEditorStore.getState().tabs[id];
    expect(tab?.encoding).toBe("win1252");
    expect(tab?.content).toBe("café");
    expect(tab?.reloadToken).toBe(tokenBefore + 1);
    expect((reads[reads.length - 1] as { encoding?: string }).encoding).toBe("win1252");
  });
});

describe("useEditorStore per-workspace isolation", () => {
  test("open files + active tab are tracked separately per project", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": readFileOk(""),
        "git.fileBaseline": () => ({ content: null }),
      }) as never,
    });
    useEditorStore.getState().openFile({ projectId: "p1", absPath: "/p1/a.ts", relPath: "a.ts" });
    useEditorStore.getState().openFile({ projectId: "p2", absPath: "/p2/b.ts", relPath: "b.ts" });
    await flush();

    const st = useEditorStore.getState();
    expect(st.byProject.p1?.order).toEqual(["p1:/p1/a.ts"]);
    expect(st.byProject.p2?.order).toEqual(["p2:/p2/b.ts"]);
    expect(st.byProject.p1?.activeTabId).toBe("p1:/p1/a.ts");
    expect(st.byProject.p2?.activeTabId).toBe("p2:/p2/b.ts");
  });
});
