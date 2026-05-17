import { Glyph } from "../components/glyph";
import { getAppVersion } from "../lib/platform";
import { PidScreenSwitcher } from "./PidScreenSwitcher";

export function PidFooter() {
  const version = getAppVersion();

  return (
    <footer className="pid-footer">
      <div className="seg">
        <Glyph kind="logo" size={12} />
        <span className="accent">pi-deck</span>
        <span className="lbl">{version}</span>
      </div>
      <div className="seg">
        <span className="lbl">screen</span>
        <PidScreenSwitcher />
      </div>
      <div className="spacer" />
    </footer>
  );
}
