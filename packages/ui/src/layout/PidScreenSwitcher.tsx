import { Tooltip } from "../components/ui/Tooltip";
import { useSessionsStore } from "../features/sessions/useSessionsStore";
import { useI18nContext } from "../i18n/i18n-react";
import type { TranslationFunctions } from "../i18n/i18n-types";
import { type NavScreen, useNavStore } from "../lib/useNavStore";
import { usePreferencesStore } from "../theme/usePreferencesStore";

type ScreenButton = {
  id: string;
  label: string;
  target: NavScreen;
};

/**
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * `id` and `target` stay identifiers — only `label` is copy.
 */
function screenButtons(t: TranslationFunctions): readonly ScreenButton[] {
  return [
    { id: "session", label: t.shell.screenSwitcher.session(), target: "session" },
    { id: "editor", label: t.shell.screenSwitcher.editor(), target: "editor" },
    { id: "diff", label: t.shell.screenSwitcher.diff(), target: "git-diff" },
    { id: "blank", label: t.shell.screenSwitcher.blank(), target: "blank" },
  ];
}

export function PidScreenSwitcher() {
  const { LL } = useI18nContext();
  const screen = useNavStore((s) => s.screen);
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const ide = usePreferencesStore((s) => s.viewMode) === "ide";

  // In IDE mode the session is docked as a right-pane tab, so its center route — and
  // thus its switcher button — is redundant.
  const all = screenButtons(LL);
  const screens = ide ? all.filter((btn) => btn.id !== "session") : all;

  return (
    <div
      className="pid-screen-switcher"
      role="toolbar"
      aria-label={LL.shell.screenSwitcher.label()}
    >
      {screens.map((btn) => {
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
            title={isSessionGate ? undefined : btn.label}
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
            <Tooltip key={btn.id} content={LL.shell.screenSwitcher.sessionGate()}>
              {buttonEl}
            </Tooltip>
          );
        }
        return buttonEl;
      })}
    </div>
  );
}
