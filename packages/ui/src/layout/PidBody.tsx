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
  const setLeftWidth = useRailState((s) => s.setLeftWidth);
  const setRightWidth = useRailState((s) => s.setRightWidth);
  const rightPaneOff = right === undefined || right === null;

  return (
    <div className="pid-body" data-rightpane={rightPaneOff ? "off" : "on"}>
      {left}
      <div className="pid-center">{center}</div>
      {right}
      <PidPanelHandle
        side="left"
        ariaLabel="Resize left rail"
        currentWidth={leftWidth}
        onResize={(delta) => setLeftWidth(leftWidth + delta)}
      />
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
