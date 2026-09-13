import { type ReactNode, useEffect, useState } from "react";
import { useI18nContext } from "../i18n/i18n-react";

/**
 * Custom min/max/close cluster for the frameless Win/Linux chrome.
 */
export function WindowControls() {
  const { LL } = useI18nContext();
  const controls = typeof window !== "undefined" ? window.windowControls : undefined;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!controls) return;
    let active = true;
    void controls.isMaximized?.().then((value) => {
      if (active) setMaximized(value);
    });
    const unsubscribe = controls.onMaximizedChange?.(setMaximized);
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [controls]);

  // Each control uses one string for both the accessible name and the native tooltip.
  const minimize = LL.shell.windowControls.minimize();
  const maximize = maximized
    ? LL.shell.windowControls.restore()
    : LL.shell.windowControls.maximize();
  const close = LL.common.close();

  return (
    <div className="pid-window-controls">
      <button
        type="button"
        className="pid-window-btn"
        aria-label={minimize}
        title={minimize}
        onClick={() => void controls?.minimize?.()}
      >
        <Glyph>
          <path d="M1 5.5h8" />
        </Glyph>
      </button>
      <button
        type="button"
        className="pid-window-btn"
        aria-label={maximize}
        title={maximize}
        onClick={() => void controls?.toggleMaximize?.()}
      >
        {maximized ? (
          <Glyph>
            <rect x="1" y="3" width="6" height="6" />
            <path d="M3 3V1h6v6H7" />
          </Glyph>
        ) : (
          <Glyph>
            <rect x="1" y="1" width="8" height="8" />
          </Glyph>
        )}
      </button>
      <button
        type="button"
        className="pid-window-btn close"
        aria-label={close}
        title={close}
        onClick={() => void controls?.close?.()}
      >
        <Glyph>
          <path d="M1 1l8 8M9 1l-8 8" />
        </Glyph>
      </button>
    </div>
  );
}

/** Thin 10×10 system-style caption glyph (1px stroke, square caps). */
function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      width={10}
      height={10}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}
