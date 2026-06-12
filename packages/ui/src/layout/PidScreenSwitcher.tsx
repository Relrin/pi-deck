import { Tooltip } from "../components/ui/Tooltip";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { type NavScreen, useNavStore } from "../lib/useNavStore";

type ScreenButton = {
  id: string;
  label: string;
  target: NavScreen;
};

const SCREENS: readonly ScreenButton[] = [
  { id: "session", label: "SESSION", target: "session" },
  { id: "editor", label: "EDITOR", target: "editor" },
  { id: "diff", label: "DIFF", target: "git-diff" },
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
        const isActive = btn.target === screen;

        const buttonEl = (
          <button
            key={isSessionGate ? undefined : btn.id}
            type="button"
            data-active={isActive ? "true" : "false"}
            data-disabled={isSessionGate ? "true" : "false"}
            aria-pressed={isActive}
            aria-disabled={isSessionGate || undefined}
            onClick={(event) => {
              if (isSessionGate) {
                event.preventDefault();
                return;
              }
              useNavStore.getState().setScreen(btn.target);
            }}
          >
            {btn.label}
          </button>
        );

        if (isSessionGate) {
          return (
            <Tooltip key={btn.id} content={SESSION_GATE_TOOLTIP}>
              {buttonEl}
            </Tooltip>
          );
        }
        return buttonEl;
      })}
    </div>
  );
}
