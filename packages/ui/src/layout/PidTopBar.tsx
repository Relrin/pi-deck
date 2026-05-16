import type { CSSProperties } from "react";
import { Glyph, type GlyphKind } from "../components/glyph";
import { Tooltip } from "../components/ui/Tooltip";

// The preload bridge exposes platform info on window.platform. Falls back to undefined
// in non-Electron contexts (web target, tests); we treat that as "non-darwin" so the
// macOS-only spacer doesn't appear in environments without native traffic lights.
type PlatformOs = "darwin" | "linux" | "win32" | string;
function getPlatformOs(): PlatformOs | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { platform?: { os?: PlatformOs } };
  return w.platform?.os;
}

// Windows + Linux paint native min/max/close inside the topbar area via
// BrowserWindow.titleBarOverlay. Those buttons sit on top of our DOM, so we
// pad the right cluster to leave room. Empirically ~140px covers Windows
// 1.0 DPI; tighter scales fit comfortably under it.
const NATIVE_OVERLAY_RESERVE_PX = 144;

interface TopBarButtonProps {
  kind: GlyphKind;
  label: string;
  tooltip: string;
}

function TopBarButton({ kind, label, tooltip }: TopBarButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label={label}
        aria-disabled
        onClick={(event) => event.preventDefault()}
      >
        <Glyph kind={kind} />
      </button>
    </Tooltip>
  );
}

export function PidTopBar() {
  const platformOs = getPlatformOs();
  const isMac = platformOs === "darwin";
  const reservesNativeOverlay = platformOs === "win32" || platformOs === "linux";

  const rightStyle: CSSProperties | undefined = reservesNativeOverlay
    ? { paddingRight: NATIVE_OVERLAY_RESERVE_PX }
    : undefined;

  return (
    <div className="pid-topbar">
      {isMac ? (
        <div className="pid-topbar-spacer" aria-hidden />
      ) : (
        // Non-mac: titleBarOverlay paints native min/max/close at the far right; the spacer
        // role is taken over by the padding on .pid-topbar-right. We still need an empty grid
        // cell here so the three-column layout stays aligned.
        <div aria-hidden />
      )}

      <div className="pid-topbar-center drag">
        <span className="pid-brand-mark" aria-hidden>
          pi
        </span>
        <span className="pid-brand-text">PI-DECK</span>
      </div>

      <div className="pid-topbar-right" style={rightStyle}>
        <TopBarButton
          kind="cmd"
          label="Command palette (coming soon)"
          tooltip="Command palette — coming in 005c"
        />
        <TopBarButton
          kind="panel-left"
          label="Toggle left rail (coming soon)"
          tooltip="Toggle left rail — coming soon"
        />
        <TopBarButton
          kind="panel-bottom"
          label="Toggle bottom panel (coming soon)"
          tooltip="Toggle bottom panel — coming soon"
        />
        <TopBarButton
          kind="panel-right"
          label="Toggle right pane (coming soon)"
          tooltip="Toggle right pane — coming soon"
        />
      </div>
    </div>
  );
}
