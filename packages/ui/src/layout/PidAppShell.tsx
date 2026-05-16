import type { CSSProperties, ReactNode } from "react";
import { useRailState } from "./use-rail-state";

export interface PidAppShellProps {
  top: ReactNode;
  body: ReactNode;
  bottom: ReactNode;
}

export function PidAppShell({ top, body, bottom }: PidAppShellProps) {
  // Drive --rail-w / --rightpane-w from the persisted store so both the topbar grid and
  // the body grid stay in sync without each subtree re-reading the state.
  const leftWidth = useRailState((s) => s.leftWidth);
  const rightWidth = useRailState((s) => s.rightWidth);
  const styleVars = {
    "--rail-w": `${leftWidth}px`,
    "--rightpane-w": `${rightWidth}px`,
  } as CSSProperties;

  return (
    <div className="pid-app" style={styleVars}>
      {top}
      {body}
      {bottom}
    </div>
  );
}
