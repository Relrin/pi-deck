import { type PointerEvent, useRef } from "react";
import { PANEL_LIMITS } from "./use-panel-state.legacy";

export type PanelHandleProps = {
  onResize: (deltaX: number) => void;
  ariaLabel: string;
  currentWidth: number;
};

export function PanelHandle({ onResize, ariaLabel, currentWidth }: PanelHandleProps) {
  const startXRef = useRef<number | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startXRef.current = event.clientX;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (startXRef.current === null) return;
    const delta = event.clientX - startXRef.current;
    if (delta === 0) return;
    startXRef.current = event.clientX;
    onResize(delta);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    startXRef.current = null;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: <hr> cannot host pointer event handlers cleanly; resize handle keeps the separator role on a div
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={currentWidth}
      aria-valuemin={PANEL_LIMITS.min}
      aria-valuemax={PANEL_LIMITS.max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        width: "4px",
        cursor: "col-resize",
        background: "transparent",
        transition: "background-color 120ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--color-border-strong)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    />
  );
}
