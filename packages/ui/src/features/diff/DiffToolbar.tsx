import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  SquareDashed,
  SquareSplitHorizontal,
  SquareSplitVertical,
} from "../../components/icons/index.js";
import { type DiffLineDiffType, usePreferencesStore } from "../../theme/usePreferencesStore.js";

/**
 * Per-screen diff toolbar — three controls, in source order:
 *
 *   1. Inline-highlight selector: dropdown of {word-alt | word | character | none}.
 *   2. Layout toggle: a single icon button that flips between unified ↔ split. The icon
 *      shown reflects the *current* mode (a vertical-split glyph for unified, horizontal
 *      for side-by-side) — clicking switches to the other.
 *   3. Background toggle: another icon button that pressurises the row-fill preference.
 *
 * All three write straight to `usePreferencesStore`, so the per-view toggle and the
 * Settings → Git & GitHub controls are the same source of truth. Changes persist.
 */
export function DiffToolbar() {
  const layout = usePreferencesStore((s) => s.diffLayout);
  const setLayout = usePreferencesStore((s) => s.setDiffLayout);
  const background = usePreferencesStore((s) => s.diffBackground);
  const setBackground = usePreferencesStore((s) => s.setDiffBackground);
  const lineDiffType = usePreferencesStore((s) => s.diffLineDiffType);
  const setLineDiffType = usePreferencesStore((s) => s.setDiffLineDiffType);

  return (
    <div className="pid-diff-toolbar" role="toolbar" aria-label="Diff display options">
      <LineDiffTypeDropdown value={lineDiffType} onChange={setLineDiffType} />
      <button
        type="button"
        className="pid-diff-toolbar-btn"
        data-active={layout === "split" || undefined}
        onClick={() => setLayout(layout === "split" ? "unified" : "split")}
        aria-label={`Switch to ${layout === "split" ? "unified" : "side-by-side"} layout`}
        aria-pressed={layout === "split"}
        title={
          layout === "split"
            ? "Side-by-side layout · click for unified"
            : "Unified layout · click for side-by-side"
        }
      >
        {layout === "split" ? (
          <SquareSplitHorizontal size={14} aria-hidden />
        ) : (
          <SquareSplitVertical size={14} aria-hidden />
        )}
      </button>
      <button
        type="button"
        className="pid-diff-toolbar-btn"
        data-active={background || undefined}
        onClick={() => setBackground(!background)}
        aria-label={background ? "Disable row backgrounds" : "Enable row backgrounds"}
        aria-pressed={background}
        title={
          background ? "Row backgrounds on · click to hide" : "Row backgrounds off · click to show"
        }
      >
        <SquareDashed size={14} aria-hidden />
      </button>
    </div>
  );
}

interface LineDiffOption {
  value: DiffLineDiffType;
  label: string;
  description: string;
}

/**
 * Surface labels — Pierre's wire value `char` becomes the user-friendly "Character"
 * here. Descriptions intentionally mirror the screenshot the user supplied so users
 * who saw that mockup recognise the dropdown immediately.
 */
const LINE_DIFF_OPTIONS: readonly LineDiffOption[] = [
  {
    value: "word-alt",
    label: "Word-Alt",
    description: "Highlight entire words with enhanced algorithm",
  },
  { value: "word", label: "Word", description: "Highlight changed words within lines" },
  { value: "char", label: "Character", description: "Highlight individual character changes" },
  { value: "none", label: "None", description: "Show line-level changes only" },
];

function labelFor(value: DiffLineDiffType): string {
  return LINE_DIFF_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

interface LineDiffTypeDropdownProps {
  value: DiffLineDiffType;
  onChange: (value: DiffLineDiffType) => void;
}

function LineDiffTypeDropdown({ value, onChange }: LineDiffTypeDropdownProps) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-diff-toolbar-select"
          aria-label="Inline change highlight algorithm"
          title="Inline change highlight algorithm"
        >
          <span className="pid-diff-toolbar-select-label">{labelFor(value)}</span>
          <ChevronDown size={12} aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          side="bottom"
          sideOffset={6}
          className="pid-diff-toolbar-menu"
        >
          <RadixDropdown.RadioGroup
            value={value}
            onValueChange={(v) => onChange(v as DiffLineDiffType)}
          >
            {LINE_DIFF_OPTIONS.map((opt) => (
              <RadixDropdown.RadioItem
                key={opt.value}
                value={opt.value}
                className="pid-diff-toolbar-menu-item"
                data-active={opt.value === value || undefined}
              >
                <span className="pid-diff-toolbar-menu-label">{opt.label}</span>
                <span className="pid-diff-toolbar-menu-desc">{opt.description}</span>
              </RadixDropdown.RadioItem>
            ))}
          </RadixDropdown.RadioGroup>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
