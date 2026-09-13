import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { ArrowLeft, PanelBottom, PanelLeft, PanelRight, Settings } from "../components/icons";
import { Tooltip } from "../components/ui/Tooltip";
import { useSettingsStore } from "../features/settings/useSettingsStore";
import { useTerminalStore } from "../features/terminal/useTerminalStore";
import { useI18nContext } from "../i18n/i18n-react";
import { getPlatformOs, metaSymbol, usesCustomWindowControls } from "../lib/platform";
import { useNavStore } from "../lib/useNavStore";
import { useRailState } from "./use-rail-state";
import { WindowControls } from "./WindowControls";

interface ToggleButtonProps {
  pressed: boolean;
  onToggle: (event: ReactMouseEvent<HTMLButtonElement>) => void;
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
  const { LL } = useI18nContext();
  const label = LL.shell.topBar.backToStart();
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label={label}
        onClick={() => useNavStore.getState().goToBlank()}
      >
        <ArrowLeft size={14} />
      </button>
    </Tooltip>
  );
}

function TopBarSettingsButton() {
  const { LL } = useI18nContext();
  // `metaSymbol()` is a key glyph (⌘ / Ctrl), not copy — it is interpolated, never translated.
  const tooltip = LL.shell.settings.shortcutTooltip({ mod: metaSymbol() });
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        className="pid-topbar-btn"
        aria-label={LL.shell.settings.open()}
        onClick={() => useSettingsStore.getState().setOpen(true)}
      >
        <Settings size={14} />
      </button>
    </Tooltip>
  );
}

export function PidTopBar() {
  const { LL } = useI18nContext();
  const platformOs = getPlatformOs();
  const isMac = platformOs === "darwin";
  const screen = useNavStore((s) => s.screen);
  const showBack = screen !== "blank";
  const leftVisible = useRailState((s) => s.leftVisible);
  const rightVisible = useRailState((s) => s.rightVisible);
  const toggleLeft = useRailState((s) => s.toggleLeft);
  const toggleRight = useRailState((s) => s.toggleRight);
  const terminalOpen = useTerminalStore((s) => s.bySession[s.currentKey]?.open ?? false);
  const showWindowControls = usesCustomWindowControls();

  return (
    <div className="pid-topbar">
      {isMac ? (
        // macOS leaves room for the native traffic lights via a transparent spacer.
        // Width is fixed (independent of panel sizes) so icon spacing on the right
        // stays consistent no matter how the user resizes the rail / right pane.
        <div
          className="pid-topbar-spacer"
          aria-hidden
          style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}
        >
          {showBack ? <BackToStartButton /> : null}
        </div>
      ) : (
        // Non-mac: min/max/close are our own <WindowControls /> at the end of the right
        // cluster. The left cluster just holds the back button off the blank screen.
        <div
          className="pid-topbar-left"
          aria-hidden
          style={{ display: "flex", alignItems: "center" }}
        >
          {showBack ? <BackToStartButton /> : null}
        </div>
      )}

      <div className="pid-topbar-right" data-window-controls={showWindowControls || undefined}>
        {/* Settings is normally housed in the left-rail footer; surface it here
            when the rail is hidden so the user keeps a visible affordance. */}
        {!leftVisible && <TopBarSettingsButton />}
        <ToggleButton
          pressed={leftVisible}
          onToggle={toggleLeft}
          showLabel={LL.shell.topBar.leftPanel.show()}
          hideLabel={LL.shell.topBar.leftPanel.hide()}
          icon={<PanelLeft size={14} />}
        />
        <ToggleButton
          pressed={terminalOpen}
          onToggle={(event) => {
            useTerminalStore.getState().togglePanel();
            event.currentTarget.blur();
          }}
          showLabel={LL.shell.topBar.bottomPanel.show()}
          hideLabel={LL.shell.topBar.bottomPanel.hide()}
          icon={<PanelBottom size={14} />}
        />
        <ToggleButton
          pressed={rightVisible}
          onToggle={toggleRight}
          showLabel={LL.shell.topBar.rightPanel.show()}
          hideLabel={LL.shell.topBar.rightPanel.hide()}
          icon={<PanelRight size={14} />}
        />
        {showWindowControls && <WindowControls />}
      </div>
    </div>
  );
}
