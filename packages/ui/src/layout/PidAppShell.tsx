import { type CSSProperties, type ReactNode, useEffect } from "react";
import { useRailState } from "./use-rail-state";

export interface PidAppShellProps {
  top: ReactNode;
  body: ReactNode;
  bottom: ReactNode;
}

export function PidAppShell({ top, body, bottom }: PidAppShellProps) {
  // Panels have no fixed max — they're capped against the window. When the window shrinks,
  // re-clamp so an over-wide panel can't push the center below its minimum (which would
  // otherwise overflow the body grid into a horizontal scrollbar).
  useEffect(() => {
    const onResize = () => useRailState.getState().clampToWindow();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Drive --rail-w / --rightpane-w from the persisted store so both the topbar grid and
  // the body grid stay in sync without each subtree re-reading the state. When a panel
  // is hidden, collapse its column to 0 so the center cell expands cleanly.
  const leftWidth = useRailState((s) => s.leftWidth);
  const rightWidth = useRailState((s) => s.rightWidth);
  const leftVisible = useRailState((s) => s.leftVisible);
  const rightVisible = useRailState((s) => s.rightVisible);
  const styleVars = {
    "--rail-w": leftVisible ? `${leftWidth}px` : "0px",
    "--rightpane-w": rightVisible ? `${rightWidth}px` : "0px",
  } as CSSProperties;

  return (
    <div className="pid-app" style={styleVars}>
      {top}
      {body}
      {bottom}
    </div>
  );
}
