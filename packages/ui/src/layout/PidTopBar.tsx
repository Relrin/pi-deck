import type { CSSProperties } from "react";
import { Glyph, type GlyphKind } from "../components/glyph";
import { Tooltip } from "../components/ui/Tooltip";
import { getPlatformOs } from "../lib/platform";
import { useNavStore } from "../lib/useNavStore";

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

function BackToStartButton() {
  return (
    <Tooltip content="Back to start">
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label="Back to start"
        onClick={() => useNavStore.getState().goToBlank()}
      >
        <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
          <Glyph kind="arrow-right" />
        </span>
      </button>
    </Tooltip>
  );
}

export function PidTopBar() {
  const platformOs = getPlatformOs();
  const isMac = platformOs === "darwin";
  const reservesNativeOverlay = platformOs === "win32" || platformOs === "linux";
  const screen = useNavStore((s) => s.screen);
  const showBack = screen !== "blank";

  const rightStyle: CSSProperties | undefined = reservesNativeOverlay
    ? { paddingRight: NATIVE_OVERLAY_RESERVE_PX }
    : undefined;

  return (
    <div className="pid-topbar">
      {isMac ? (
        <div
          className="pid-topbar-spacer"
          aria-hidden
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}
        >
          {showBack ? <BackToStartButton /> : null}
        </div>
      ) : (
        // Non-mac: titleBarOverlay paints native min/max/close at the far right; the spacer
        // role is taken over by the padding on .pid-topbar-right. We still need an empty grid
        // cell here so the three-column layout stays aligned.
        <div aria-hidden style={{ display: "flex", alignItems: "center" }}>
          {showBack ? <BackToStartButton /> : null}
        </div>
      )}

      <div className="pid-topbar-center drag">
        <span className="pid-brand-mark" aria-hidden>
          pi
        </span>
        <span className="pid-brand-text">PI-DECK</span>
      </div>

      <div className="pid-topbar-right" style={rightStyle}>
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
