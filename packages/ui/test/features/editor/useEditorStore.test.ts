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
  (content: string, eol: "lf" | "crlf" = "lf") =>
  () => ({
    content,
    eol,
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

  test("binary files open read-only and blocked", async () => {
    useSessionsStore.setState({
      client: mockClient({
        "fs.readFile": () => ({
          content: "",
          eol: "lf",
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
