import type { CSSProperties, ReactNode } from "react";
import { TerminalDock } from "../features/terminal/TerminalDock";
import { TERMINAL_DEFAULT_HEIGHT, useTerminalStore } from "../features/terminal/useTerminalStore";
import { usePreferencesStore } from "../theme/usePreferencesStore";
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

  // The integrated terminal lives at body level (not inside the center column) so it can span
  // over the side panels. Its width mode is a global Appearance preference; coverage only takes
  // effect while the terminal is actually open.
  const terminalWidth = usePreferencesStore((s) => s.terminalWidth);
  const terminalOpen = useTerminalStore((s) => s.bySession[s.currentKey]?.open ?? false);
  const terminalHeight = useTerminalStore(
    (s) => s.bySession[s.currentKey]?.height ?? TERMINAL_DEFAULT_HEIGHT,
  );
  const coverLeft = terminalOpen && (terminalWidth === "center-left" || terminalWidth === "all");
  const coverRight = terminalOpen && (terminalWidth === "center-right" || terminalWidth === "all");

  // Drives how far the rail/pane resize handles stop short of the bottom so they don't cross a
  // terminal that spans their column (see .pid-body[data-term-cover-*] rules in shell.css).
  const styleVars = {
    "--term-dock-h": terminalOpen ? `${terminalHeight}px` : "0px",
  } as CSSProperties;

  // A consumer that passes no `right` prop turns the right pane off structurally
  // (e.g. screens with no context column). Visibility toggling via the topbar is
  // orthogonal and goes through the store.
  const rightPaneOff = right === undefined || right === null || !rightVisible;
  const leftRailOff = !leftVisible;

  return (
    <div
      className="pid-body"
      style={styleVars}
      data-leftrail={leftRailOff ? "off" : "on"}
      data-rightpane={rightPaneOff ? "off" : "on"}
      data-term-cover-left={coverLeft ? "true" : undefined}
      data-term-cover-right={coverRight ? "true" : undefined}
    >
      {!leftRailOff && left}
      <div className="pid-center">{center}</div>
      {!rightPaneOff && right}
      <TerminalDock />
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
