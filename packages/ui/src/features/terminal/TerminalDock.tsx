import { useEffect } from "react";
import { PidBottomHandle } from "../../layout/PidBottomHandle.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { TerminalPane } from "./TerminalPane.js";
import { GLOBAL_SCOPE, TERMINAL_DEFAULT_HEIGHT, useTerminalStore } from "./useTerminalStore.js";

/**
 * The bottom dock row of the app shell. Syncs the terminal store's scope to the active pi-deck
 * session (so each session shows its own tabs), and renders the resize handle + `TerminalPane`
 * when the panel is open. Returns null when closed so the grid row collapses and the footer
 * sits directly under the body.
 */
export function TerminalDock() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const setScope = useTerminalStore((s) => s.setScope);
  const open = useTerminalStore((s) => s.bySession[s.currentKey]?.open ?? false);
  const height = useTerminalStore(
    (s) => s.bySession[s.currentKey]?.height ?? TERMINAL_DEFAULT_HEIGHT,
  );
  const setHeight = useTerminalStore((s) => s.setHeight);

  useEffect(() => {
    setScope(activeSessionId ?? GLOBAL_SCOPE);
  }, [activeSessionId, setScope]);

  // Always render the dock element (0-height when closed) so it stays the 3rd grid item and the
  // footer keeps its place in the last grid track.
  return (
    <div className="pid-dock" style={open ? { height } : undefined} data-open={open}>
      {open && (
        <>
          <PidBottomHandle currentHeight={height} onResize={(delta) => setHeight(height - delta)} />
          <TerminalPane />
        </>
      )}
    </div>
  );
}
