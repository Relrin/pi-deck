import { type PointerEvent, useRef } from "react";
import { RAIL_LIMITS } from "./use-rail-state";

export interface PidPanelHandleProps {
  side: "left" | "right";
  ariaLabel: string;
  currentWidth: number;
  onResize: (deltaX: number) => void;
}

export function PidPanelHandle({ side, ariaLabel, currentWidth, onResize }: PidPanelHandleProps) {
  const startXRef = useRef<number | null>(null);
  // Each side has its own resize floor — the right pane is taller because of the git
  // commit composer. Surface the side-specific min through `aria-valuemin` so assistive
  // tech reads the same number that the store actually enforces on the value.
  const minWidth = side === "right" ? RAIL_LIMITS.minRight : RAIL_LIMITS.minLeft;
  // No fixed ceiling: the upper bound is whatever the window leaves after the protected
  // center minimum. Report that to assistive tech; omit it entirely when there's no window.
  const maxWidth =
    typeof window === "undefined" ? undefined : window.innerWidth - RAIL_LIMITS.minCenter;

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
    // biome-ignore lint/a11y/useSemanticElements: <hr> cannot host pointer event handlers cleanly; the separator role on a div is the conventional resize-handle pattern
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuenow={currentWidth}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`pid-panel-handle pid-panel-handle--${side}`}
    />
  );
}
