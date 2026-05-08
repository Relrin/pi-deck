import { ContextSidebar } from "./ContextSidebar";
import { MainPanel } from "./MainPanel";
import { PanelHandle } from "./PanelHandle";
import { SessionsSidebar } from "./SessionsSidebar";
import { usePanelState } from "./use-panel-state";

const COLLAPSED_WIDTH = 36;

export function AppShell() {
  const left = usePanelState((s) => s.left);
  const right = usePanelState((s) => s.right);
  const setLeftWidth = usePanelState((s) => s.setLeftWidth);
  const setRightWidth = usePanelState((s) => s.setRightWidth);

  const leftCol = left.collapsed ? `${COLLAPSED_WIDTH}px` : `${left.width}px`;
  const rightCol = right.collapsed ? `${COLLAPSED_WIDTH}px` : `${right.width}px`;

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "grid",
        gridTemplateColumns: `${leftCol} 4px minmax(0, 1fr) 4px ${rightCol}`,
        gridTemplateRows: "100%",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <SessionsSidebar />
      {left.collapsed ? (
        <div />
      ) : (
        <PanelHandle
          ariaLabel="Resize sessions sidebar"
          currentWidth={left.width}
          onResize={(delta) => setLeftWidth(left.width + delta)}
        />
      )}
      <MainPanel />
      {right.collapsed ? (
        <div />
      ) : (
        <PanelHandle
          ariaLabel="Resize context sidebar"
          currentWidth={right.width}
          onResize={(delta) => setRightWidth(right.width - delta)}
        />
      )}
      <ContextSidebar />
    </div>
  );
}
