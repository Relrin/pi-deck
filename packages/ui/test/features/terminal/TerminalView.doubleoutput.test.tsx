import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { StrictMode } from "react";

// Fake emulator handles — record every write so we can detect double-painting, and track how
// many live (undisposed) emulators exist so we can detect a leaked second emulator.
interface FakeHandle {
  backend: "ghostty";
  writes: string[];
  disposed: boolean;
  onData: (data: string) => void;
  write(d: string): void;
  resize(): void;
  fit(): { cols: number; rows: number };
  focus(): void;
  setTheme(): void;
  setFont(): void;
  getSelection(): string;
  scrollToBottom(): void;
  dispose(): void;
}

const handles: FakeHandle[] = [];

mock.module("../../../src/features/terminal/TerminalRenderer.js", () => ({
  mountTerminal: async (_container: HTMLElement, init: { onData: (d: string) => void }) => {
    const handle: FakeHandle = {
      backend: "ghostty",
      writes: [],
      disposed: false,
      onData: init.onData,
      write(d: string) {
        this.writes.push(d);
      },
      resize() {},
      fit() {
        return { cols: 80, rows: 24 };
      },
      focus() {},
      setTheme() {},
      setFont() {},
      getSelection() {
        return "";
      },
      scrollToBottom() {},
      dispose() {
        this.disposed = true;
      },
    };
    handles.push(handle);
    return handle;
  },
}));

// Imported AFTER mock.module so TerminalView binds to the fake renderer.
const { render, act } = await import("../../utils");
const { TerminalView } = await import("../../../src/features/terminal/TerminalView");
const { useSessionsStore } = await import("../../../src/features/sessions/useSessionsStore");
const { encodeBase64Utf8, dispatchTerminalOutput } = await import(
  "../../../src/features/terminal/terminalOutput"
);

const writeCalls: Array<{ id: string; data: string }> = [];

function fakeClient() {
  return {
    terminal: {
      open: async () => ({ terminalId: "X", cwd: "/tmp", shell: "/bin/zsh", cols: 80, rows: 24 }),
      snapshot: async () => ({ dataB64: "" }),
      resize: async () => ({}),
      write: async (id: string, dataB64: string) => {
        writeCalls.push({ id, data: dataB64 });
        return {};
      },
      close: async () => ({}),
    },
  };
}

async function flush() {
  // Drain the effect's chain of awaits (mountTerminal → open → snapshot → subscribe).
  for (let i = 0; i < 6; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const tab = { tabId: "t1", cwd: "/tmp", terminalId: null, exited: false };

describe("TerminalView — no double output under StrictMode", () => {
  beforeEach(() => {
    handles.length = 0;
    writeCalls.length = 0;
    // biome-ignore lint/suspicious/noExplicitAny: minimal client stub for the effect path
    useSessionsStore.setState({ client: fakeClient() as any });
  });

  afterEach(() => {
    useSessionsStore.setState({ client: undefined });
  });

  test("a single live output frame is painted exactly once", async () => {
    render(
      <StrictMode>
        <TerminalView tab={tab} />
      </StrictMode>,
    );
    await flush();

    const live = handles.filter((h) => !h.disposed);
    expect(live.length).toBe(1);

    dispatchTerminalOutput("X", encodeBase64Utf8("hello"), false);

    const painted = live[0]?.writes.filter((w) => w.includes("hello")) ?? [];
    expect(painted.length).toBe(1);
  });

  test("a single keystroke is written to the PTY exactly once", async () => {
    render(
      <StrictMode>
        <TerminalView tab={tab} />
      </StrictMode>,
    );
    await flush();

    const live = handles.filter((h) => !h.disposed);
    expect(live.length).toBe(1);

    // Simulate the emulator emitting one keystroke.
    live[0]?.onData("a");
    const aWrites = writeCalls.filter((c) => c.data === encodeBase64Utf8("a"));
    expect(aWrites.length).toBe(1);
  });
});
