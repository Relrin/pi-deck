import { PidEditorStatus } from "../features/editor/PidEditorStatus";
import { getAppVersion } from "../lib/platform";
import { useNavStore } from "../lib/useNavStore";
import { PidScreenSwitcher } from "./PidScreenSwitcher";

export function PidFooter() {
  const version = getAppVersion();
  const screen = useNavStore((s) => s.screen);

  return (
    <footer className="pid-footer">
      <div className="seg">
        <span className="accent">pi-deck</span>
        <span className="lbl">{version}</span>
      </div>
      <div className="seg">
        <span className="lbl">screen</span>
        <PidScreenSwitcher />
      </div>
      <div className="spacer" />
      {screen === "editor" ? <PidEditorStatus /> : null}
    </footer>
  );
}
