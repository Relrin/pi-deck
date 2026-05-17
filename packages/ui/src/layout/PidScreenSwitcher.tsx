import { Tooltip } from "../components/ui/Tooltip";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { type NavScreen, useNavStore } from "../lib/useNavStore";

type ScreenButton = {
  id: string;
  label: string;
  target: NavScreen | null;
  disabledTooltip?: string;
};

const SCREENS: readonly ScreenButton[] = [
  { id: "session", label: "SESSION", target: "session" },
  { id: "editor", label: "EDITOR", target: "editor" },
  { id: "diff", label: "DIFF", target: "git-diff" },
  { id: "history", label: "HISTORY", target: "git-history" },
  { id: "overview", label: "OVERVIEW", target: null, disabledTooltip: "Coming soon" },
  { id: "blank", label: "BLANK", target: "blank" },
];

const SESSION_GATE_TOOLTIP = "Open a session first";

export function PidScreenSwitcher() {
  const screen = useNavStore((s) => s.screen);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);

  return (
    <div className="pid-screen-switcher" role="toolbar" aria-label="Switch screen">
      {SCREENS.map((btn) => {
        const isSessionGate = btn.target === "session" && !activeSessionId;
        const isDisabled = btn.target === null || isSessionGate;
        const isActive = btn.target !== null && btn.target === screen;
        const tooltip = isSessionGate
          ? SESSION_GATE_TOOLTIP
          : btn.target === null
            ? (btn.disabledTooltip ?? "Coming soon")
            : null;

        const buttonEl = (
          <button
            key={tooltip ? undefined : btn.id}
            type="button"
            data-active={isActive ? "true" : "false"}
            data-disabled={isDisabled ? "true" : "false"}
            aria-pressed={isActive}
            aria-disabled={isDisabled || undefined}
            onClick={(event) => {
              if (isDisabled || btn.target === null) {
                event.preventDefault();
                return;
              }
              useNavStore.getState().setScreen(btn.target);
            }}
          >
            {btn.label}
          </button>
        );

        if (tooltip) {
          return (
            <Tooltip key={btn.id} content={tooltip}>
              {buttonEl}
            </Tooltip>
          );
        }
        return buttonEl;
      })}
    </div>
  );
}
