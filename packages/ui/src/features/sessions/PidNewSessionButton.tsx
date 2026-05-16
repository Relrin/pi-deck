import { Glyph } from "../../components/glyph";
import { PidKbd } from "../../components/kbd/PidKbd";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "./useProjectsStore";
import { useSessionsStore } from "./useSessionsStore";

export function PidNewSessionButton() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const disabled = !activeProjectId;
  const label = disabled ? "Open a project first" : "Create new session";

  const onClick = () => {
    if (!activeProjectId) return;
    useSessionsStore
      .getState()
      .createSession(activeProjectId)
      .then(() => {
        useNavStore.getState().goToSession();
      })
      .catch(() => {});
  };

  return (
    <button
      type="button"
      className="pid-rail-new"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      <Glyph kind="plus" size={12} />
      <span className="pid-rail-new-label">new session</span>
      <PidKbd keys={["Mod", "N"]} />
    </button>
  );
}
