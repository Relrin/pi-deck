import { useEffect, useState } from "react";
import { RESPONSIVE_BREAKPOINT_PX } from "../lib/ui-constants";
import { useMediaQuery } from "../lib/useMediaQuery";
import { ContextSidebar } from "./ContextSidebar.legacy";
import { MainPanel } from "./MainPanel.legacy";
import { PanelHandle } from "./PanelHandle.legacy";
import { ResponsiveTopBar } from "./ResponsiveTopBar.legacy";
import { SessionsSidebar } from "./SessionsSidebar.legacy";
import { usePanelState } from "./use-panel-state.legacy";

const COLLAPSED_WIDTH = 36;

export function AppShell() {
  const left = usePanelState((s) => s.left);
  const right = usePanelState((s) => s.right);
  const setLeftWidth = usePanelState((s) => s.setLeftWidth);
  const setRightWidth = usePanelState((s) => s.setRightWidth);
  const isNarrow = useMediaQuery(`(max-width: ${RESPONSIVE_BREAKPOINT_PX - 1}px)`);
  const [drawerOpen, setDrawerOpen] = useState<"left" | "right" | null>(null);

  // When the viewport leaves narrow mode, close any open drawer so the persistent layout
  // doesn't end up with an orphaned overlay.
  useEffect(() => {
    if (!isNarrow) setDrawerOpen(null);
  }, [isNarrow]);

  if (isNarrow) {
    return (
      <div
        style={{
          height: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          background: "var(--color-bg)",
          color: "var(--color-text)",
        }}
      >
        <ResponsiveTopBar
          onOpenSessions={() => setDrawerOpen("left")}
          onOpenContext={() => setDrawerOpen("right")}
        />
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <MainPanel />
          {drawerOpen !== null && (
            <button
              type="button"
              aria-label="Close drawer"
              onClick={() => setDrawerOpen(null)}
              style={{
                position: "absolute",
                inset: 0,
                background: "color-mix(in oklab, black 50%, transparent)",
                zIndex: 30,
                transition: "opacity 150ms ease",
                border: 0,
                cursor: "default",
                padding: 0,
              }}
            />
          )}
          {drawerOpen === "left" && (
            <div
              role="dialog"
              aria-label="Sessions"
              aria-modal="true"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: "min(80vw, 320px)",
                background: "var(--color-panel)",
                borderRight: "1px solid var(--color-border)",
                zIndex: 31,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <SessionsSidebar onCloseDrawer={() => setDrawerOpen(null)} />
            </div>
          )}
          {drawerOpen === "right" && (
            <div
              role="dialog"
              aria-label="Context"
              aria-modal="true"
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "min(80vw, 360px)",
                background: "var(--color-panel)",
                borderLeft: "1px solid var(--color-border)",
                zIndex: 31,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              }}
            >
              <ContextSidebar onCloseDrawer={() => setDrawerOpen(null)} />
            </div>
          )}
        </div>
      </div>
    );
  }

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
