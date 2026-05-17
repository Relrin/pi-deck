import type { ReactNode } from "react";
import { PidPanelHandle } from "./PidPanelHandle";
import { useRailState } from "./use-rail-state";

export interface PidBodyProps {
  left: ReactNode;
  center: ReactNode;
  right?: ReactNode;
}

export function PidBody({ left, center, right }: PidBodyProps) {
  const leftWidth = useRailState((s) => s.leftWidth);
  const rightWidth = useRailState((s) => s.rightWidth);
  const leftVisible = useRailState((s) => s.leftVisible);
  const rightVisible = useRailState((s) => s.rightVisible);
  const setLeftWidth = useRailState((s) => s.setLeftWidth);
  const setRightWidth = useRailState((s) => s.setRightWidth);

  // A consumer that passes no `right` prop turns the right pane off structurally
  // (e.g. screens with no context column). Visibility toggling via the topbar is
  // orthogonal and goes through the store.
  const rightPaneOff = right === undefined || right === null || !rightVisible;
  const leftRailOff = !leftVisible;

  return (
    <div
      className="pid-body"
      data-leftrail={leftRailOff ? "off" : "on"}
      data-rightpane={rightPaneOff ? "off" : "on"}
    >
      {!leftRailOff && left}
      <div className="pid-center">{center}</div>
      {!rightPaneOff && right}
      {!leftRailOff && (
        <PidPanelHandle
          side="left"
          ariaLabel="Resize left rail"
          currentWidth={leftWidth}
          onResize={(delta) => setLeftWidth(leftWidth + delta)}
        />
      )}
      {!rightPaneOff && (
        <PidPanelHandle
          side="right"
          ariaLabel="Resize right pane"
          currentWidth={rightWidth}
          onResize={(delta) => setRightWidth(rightWidth - delta)}
        />
      )}
    </div>
  );
}
