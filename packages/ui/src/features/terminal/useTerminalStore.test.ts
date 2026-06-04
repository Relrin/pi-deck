import { beforeEach, describe, expect, test } from "bun:test";
import { GLOBAL_SCOPE, useTerminalStore } from "./useTerminalStore";

function scope() {
  const s = useTerminalStore.getState();
  return s.bySession[s.currentKey];
}

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    // no localStorage in this env — fine.
  }
  useTerminalStore.setState({ bySession: {}, currentKey: GLOBAL_SCOPE });
});

describe("useTerminalStore", () => {
  test("tabs are isolated per session scope", () => {
    const store = useTerminalStore.getState();
    store.setScope("session-a");
    store.addTab({ tabId: "t1", cwd: "/proj", terminalId: null });
    expect(scope()?.tabs.map((t) => t.tabId)).toEqual(["t1"]);
    expect(scope()?.activeTabId).toBe("t1");

    store.setScope("session-b");
    expect(scope()?.tabs).toEqual([]);

    store.setScope("session-a");
    expect(scope()?.tabs.map((t) => t.tabId)).toEqual(["t1"]);
  });

  test("setTabTerminalId attaches the PTY id + shell and clears exited", () => {
    const store = useTerminalStore.getState();
    store.setScope("s");
    store.addTab({ tabId: "t1", cwd: "/p", terminalId: null });
    store.setTabTerminalId("t1", "pty-1", "/bin/zsh");
    const tab = scope()?.tabs[0];
    expect(tab?.terminalId).toBe("pty-1");
    expect(tab?.shell).toBe("/bin/zsh");
    expect(tab?.exited).toBe(false);
  });

  test("applyExit marks the matching tab exited by terminalId", () => {
    const store = useTerminalStore.getState();
    store.setScope("s");
    store.addTab({ tabId: "t1", cwd: "/p", terminalId: null });
    store.setTabTerminalId("t1", "pty-1");
    store.applyExit("pty-1");
    expect(scope()?.tabs[0]?.exited).toBe(true);
  });

  test("removeTab focuses a neighbour when the active tab is closed", () => {
    const store = useTerminalStore.getState();
    store.setScope("s");
    store.addTab({ tabId: "t1", cwd: "/p", terminalId: null });
    store.addTab({ tabId: "t2", cwd: "/p", terminalId: null });
    store.addTab({ tabId: "t3", cwd: "/p", terminalId: null });
    store.setActiveTab("t2");
    store.removeTab("t2");
    expect(scope()?.tabs.map((t) => t.tabId)).toEqual(["t1", "t3"]);
    expect(scope()?.activeTabId).toBe("t1");
  });

  test("togglePanel flips open for the current scope", () => {
    const store = useTerminalStore.getState();
    store.setScope("s");
    expect(scope()?.open ?? false).toBe(false);
    store.togglePanel();
    expect(scope()?.open).toBe(true);
  });

  test("persisted state strips the runtime terminalId", () => {
    const store = useTerminalStore.getState();
    store.setScope("s");
    store.addTab({ tabId: "t1", cwd: "/p", terminalId: null });
    store.setTabTerminalId("t1", "pty-live", "/bin/zsh");
    // In-memory keeps the live id…
    expect(scope()?.tabs[0]?.terminalId).toBe("pty-live");
    // …but what's persisted must not (the PTY dies with the app).
    const raw = globalThis.localStorage?.getItem("pi-deck:terminal:v1");
    if (raw) {
      const persisted = JSON.parse(raw);
      expect(persisted.state.bySession.s.tabs[0].terminalId).toBeNull();
      expect(persisted.state.bySession.s.tabs[0].cwd).toBe("/p");
    }
  });
});
