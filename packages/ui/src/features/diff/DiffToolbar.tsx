import { PidChip } from "../../components/chip/PidChip.js";
import { useDiffSettingsStore } from "./useDiffSettingsStore.js";

/* Per-context toolbar above the diff. */
export function DiffToolbar() {
  const layout = useDiffSettingsStore((s) => s.layout);
  const wordHighlight = useDiffSettingsStore((s) => s.wordHighlight);
  const setLayout = useDiffSettingsStore((s) => s.setLayout);
  const setWordHighlight = useDiffSettingsStore((s) => s.setWordHighlight);

  return (
    <div className="pid-diff-toolbar">
      <fieldset className="pid-diff-toolbar-group" aria-label="Diff layout">
        <ToggleChip
          active={layout === "split"}
          onClick={() => setLayout("split")}
          label="side-by-side"
        />
        <ToggleChip
          active={layout === "unified"}
          onClick={() => setLayout("unified")}
          label="unified"
        />
      </fieldset>
      <ToggleChip
        active={wordHighlight}
        onClick={() => setWordHighlight(!wordHighlight)}
        label="word diff"
        ariaLabel="Toggle word-level diff highlight"
      />
    </div>
  );
}

interface ToggleChipProps {
  active: boolean;
  label: string;
  ariaLabel?: string;
  onClick: () => void;
}

function ToggleChip({ active, label, ariaLabel, onClick }: ToggleChipProps) {
  return (
    <PidChip
      role="button"
      tabIndex={0}
      variant={active ? "accent" : "default"}
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      {label}
    </PidChip>
  );
}
