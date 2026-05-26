import { Plus } from "../../components/icons/index.js";
import { PidKbd } from "../../components/kbd/PidKbd";
import { useNavStore } from "../../lib/useNavStore";
import { useProjectsStore } from "./useProjectsStore";

export function PidNewSessionButton() {
  const activeProjectId = useProjectsStore((s) => s.activeProjectId);
  const disabled = !activeProjectId;
  const label = disabled ? "Open a project first" : "New session";

  // Clicking "new session" routes the user to the blank/composer screen instead of
  // eagerly creating an empty session. The actual session is created on the first prompt
  // submit inside PidComposerScreen — matches "intent to start" UX.
  const onClick = () => {
    if (!activeProjectId) return;
    useNavStore.getState().goToBlank();
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
      <Plus size={12} />
      <span className="pid-rail-new-label">new session</span>
      <PidKbd keys={["Mod", "N"]} />
    </button>
  );
}
