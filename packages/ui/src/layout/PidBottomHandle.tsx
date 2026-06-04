import { type PointerEvent, useRef } from "react";
import { TERMINAL_MAX_HEIGHT, TERMINAL_MIN_HEIGHT } from "../features/terminal/useTerminalStore";

export interface PidBottomHandleProps {
  currentHeight: number;
  /** Pointer delta-Y in px (positive = dragged down). */
  onResize: (deltaY: number) => void;
}

/**
 * Horizontal drag handle along the top edge of the bottom terminal dock. Dragging up grows the
 * dock, dragging down shrinks it — the consumer maps the delta to a height. Mirrors
 * `PidPanelHandle` but on the vertical axis.
 */
export function PidBottomHandle({ currentHeight, onResize }: PidBottomHandleProps) {
  const startYRef = useRef<number | null>(null);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startYRef.current = event.clientY;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (startYRef.current === null) return;
    const delta = event.clientY - startYRef.current;
    if (delta === 0) return;
    startYRef.current = event.clientY;
    onResize(delta);
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    startYRef.current = null;
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: a div with role=separator is the conventional resize-handle pattern; <hr> can't host pointer handlers cleanly.
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label="Resize terminal panel"
      aria-valuenow={currentHeight}
      aria-valuemin={TERMINAL_MIN_HEIGHT}
      aria-valuemax={TERMINAL_MAX_HEIGHT}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="pid-dock-handle"
    />
  );
}
