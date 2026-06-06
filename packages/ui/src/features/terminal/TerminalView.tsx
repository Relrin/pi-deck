import { useEffect, useRef, useState } from "react";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { mountTerminal, type TerminalRendererHandle } from "./TerminalRenderer.js";
import { decodeBase64Utf8, encodeBase64Utf8, subscribeTerminalOutput } from "./terminalOutput.js";
import { useTerminalTheme } from "./useGhosttyTheme.js";
import { useTerminalSettingsStore } from "./useTerminalSettingsStore.js";
import { type TerminalTab, useTerminalStore } from "./useTerminalStore.js";

function resolveFontFamily(configured: string): string {
  if (configured.trim()) return configured;
  if (typeof document === "undefined") return "monospace";
  const token = getComputedStyle(document.documentElement).getPropertyValue("--font-mono").trim();
  return token || "monospace";
}

/**
 * Renders one terminal tab: mounts the ghostty-web emulator, opens or
 * reattaches to its host PTY, repaints recent scrollback from the host buffer, then streams live
 * output. User keystrokes and grid resizes are forwarded to the PTY over the protocol.
 *
 * Only the active tab is mounted at a time; switching tabs disposes the emulator (the PTY keeps
 * running on the host) and remounting repaints from the snapshot.
 */
export function TerminalView({ tab }: { tab: TerminalTab }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<TerminalRendererHandle | null>(null);
  const terminalIdRef = useRef<string | null>(null);
  const throttleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [throttled, setThrottled] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const theme = useTerminalTheme();
  const fontFamily = useTerminalSettingsStore((s) => s.fontFamily);
  const fontSize = useTerminalSettingsStore((s) => s.fontSize);
  const shellPath = useTerminalSettingsStore((s) => s.shellPath);
  const setTabTerminalId = useTerminalStore((s) => s.setTabTerminalId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: theme/font are pushed to the live handle via the effects below; only tab identity / restart should re-mount the emulator.
  useEffect(() => {
    const container = containerRef.current;
    const client = useSessionsStore.getState().client;
    if (!container || !client) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    const markThrottled = () => {
      setThrottled(true);
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      throttleTimer.current = setTimeout(() => setThrottled(false), 700);
    };

    void (async () => {
      const handle = await mountTerminal(container, {
        fontFamily: resolveFontFamily(fontFamily),
        fontSize,
        theme,
        onData: (data) => {
          const id = terminalIdRef.current;
          if (id) void client.terminal.write(id, encodeBase64Utf8(data)).catch(() => undefined);
        },
        onResize: (cols, rows) => {
          const id = terminalIdRef.current;
          if (id) void client.terminal.resize(id, cols, rows).catch(() => undefined);
        },
      });
      if (disposed) {
        handle.dispose();
        return;
      }
      handleRef.current = handle;
      const measured = handle.fit();
      const cols = measured && measured.cols > 0 ? measured.cols : 80;
      const rows = measured && measured.rows > 0 ? measured.rows : 24;

      // A live terminalId carried by the tab (set on a previous mount) → reattach; a restart or
      // a fresh tab → open a new PTY.
      let id = restartKey === 0 ? tab.terminalId : null;
      if (!id) {
        try {
          const opened = await client.terminal.open({
            cwd: tab.cwd,
            cols,
            rows,
            shell: tab.requestedShell?.path ?? shellPath ?? undefined,
            shellArgs: tab.requestedShell?.args,
          });
          id = opened.terminalId;
          setTabTerminalId(tab.tabId, opened.terminalId, opened.shell);
        } catch (err) {
          if (!disposed) {
            const msg = err instanceof Error ? err.message : "failed to start shell";
            handle.write(`\r\n\x1b[31m[terminal] ${msg}\x1b[0m\r\n`);
          }
          return;
        }
      }
      if (disposed) return;
      terminalIdRef.current = id;

      try {
        const snap = await client.terminal.snapshot(id);
        if (!disposed && snap.dataB64) handle.write(decodeBase64Utf8(snap.dataB64));
      } catch {
        // No snapshot for a brand-new PTY — expected.
      }
      if (disposed) return;
      unsubscribe = subscribeTerminalOutput(id, (data, isThrottled) => {
        handleRef.current?.write(data);
        if (isThrottled) markThrottled();
      });
      void client.terminal.resize(id, cols, rows).catch(() => undefined);
      handle.focus();
    })();

    return () => {
      disposed = true;
      unsubscribe?.();
      if (throttleTimer.current) clearTimeout(throttleTimer.current);
      handleRef.current?.dispose();
      handleRef.current = null;
      terminalIdRef.current = null;
    };
  }, [tab.tabId, tab.cwd, tab.requestedShell?.path, restartKey]);

  useEffect(() => {
    handleRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    handleRef.current?.setFont(resolveFontFamily(fontFamily), fontSize);
    handleRef.current?.fit();
  }, [fontFamily, fontSize]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (container.clientWidth > 0 && container.clientHeight > 0) handleRef.current?.fit();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="pid-terminal-view">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: focus delegation to the emulator. */}
      <div
        ref={containerRef}
        className="pid-terminal-surface"
        onMouseDown={() => handleRef.current?.focus()}
      />
      {throttled && <div className="pid-terminal-throttle">[output throttled]</div>}
      {tab.exited && (
        <div className="pid-terminal-exited" role="status">
          <span>Process exited</span>
          <button type="button" onClick={() => setRestartKey((k) => k + 1)}>
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
