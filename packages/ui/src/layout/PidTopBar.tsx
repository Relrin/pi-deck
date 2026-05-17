import type { CSSProperties, ReactNode } from "react";
import { Glyph, type GlyphKind } from "../components/glyph";
import { PanelBottom, PanelLeft, PanelRight, Sliders } from "../components/icons";
import { Tooltip } from "../components/ui/Tooltip";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { getPlatformOs, isMacOs } from "../lib/platform";
import { useNavStore } from "../lib/useNavStore";
import { useRailState } from "./use-rail-state";

// Windows + Linux paint native min/max/close inside the topbar area via
// BrowserWindow.titleBarOverlay. Those buttons sit on top of our DOM, so we
// pad the right cluster to leave room. Empirically ~140px covers Windows
// 1.0 DPI; tighter scales fit comfortably under it.
const NATIVE_OVERLAY_RESERVE_PX = 144;

interface PlaceholderButtonProps {
  kind: GlyphKind;
  label: string;
  tooltip: string;
  icon?: ReactNode;
}

function PlaceholderButton({ kind, label, tooltip, icon }: PlaceholderButtonProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label={label}
        aria-disabled
        onClick={(event) => event.preventDefault()}
      >
        {icon ?? <Glyph kind={kind} />}
      </button>
    </Tooltip>
  );
}

interface ToggleButtonProps {
  pressed: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  icon: ReactNode;
}

function ToggleButton({ pressed, onToggle, showLabel, hideLabel, icon }: ToggleButtonProps) {
  const label = pressed ? hideLabel : showLabel;
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onToggle}
      >
        {icon}
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

function TopBarSettingsButton() {
  const tooltip = `Settings (${isMacOs() ? "⌘" : "Ctrl"}+,)`;
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label="Open settings"
        onClick={() => useSettingsStore.getState().setOpen(true)}
      >
        <Sliders size={14} />
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
  const leftVisible = useRailState((s) => s.leftVisible);
  const rightVisible = useRailState((s) => s.rightVisible);
  const toggleLeft = useRailState((s) => s.toggleLeft);
  const toggleRight = useRailState((s) => s.toggleRight);

  const rightStyle: CSSProperties | undefined = reservesNativeOverlay
    ? { paddingRight: NATIVE_OVERLAY_RESERVE_PX }
    : undefined;

  return (
    <div
      className="pid-topbar"
      data-leftrail={leftVisible ? "on" : "off"}
      data-rightpane={rightVisible ? "on" : "off"}
    >
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
        {/* Settings is normally housed in the left-rail footer; surface it here
            when the rail is hidden so the user keeps a visible affordance. */}
        {!leftVisible && <TopBarSettingsButton />}
        <ToggleButton
          pressed={leftVisible}
          onToggle={toggleLeft}
          showLabel="Show left rail"
          hideLabel="Hide left rail"
          icon={<PanelLeft size={14} />}
        />
        <PlaceholderButton
          kind="panel-bottom"
          label="Toggle bottom panel (coming soon)"
          tooltip="Toggle bottom panel — coming soon"
          icon={<PanelBottom size={14} />}
        />
        <ToggleButton
          pressed={rightVisible}
          onToggle={toggleRight}
          showLabel="Show right pane"
          hideLabel="Hide right pane"
          icon={<PanelRight size={14} />}
        />
      </div>
    </div>
  );
}
