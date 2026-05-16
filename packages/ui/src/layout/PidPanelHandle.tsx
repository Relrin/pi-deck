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
      aria-valuemin={RAIL_LIMITS.min}
      aria-valuemax={RAIL_LIMITS.max}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`pid-panel-handle pid-panel-handle--${side}`}
    />
  );
}
