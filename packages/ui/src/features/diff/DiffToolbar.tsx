import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import {
  ChevronDown,
  SquareDashed,
  SquareSplitHorizontal,
  SquareSplitVertical,
} from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
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
  const { LL } = useI18nContext();
  const copy = LL.diff.toolbar;
  const layout = usePreferencesStore((s) => s.diffLayout);
  const setLayout = usePreferencesStore((s) => s.setDiffLayout);
  const background = usePreferencesStore((s) => s.diffBackground);
  const setBackground = usePreferencesStore((s) => s.setDiffBackground);
  const lineDiffType = usePreferencesStore((s) => s.diffLineDiffType);
  const setLineDiffType = usePreferencesStore((s) => s.setDiffLineDiffType);

  return (
    <div className="pid-diff-toolbar" role="toolbar" aria-label={copy.label()}>
      <LineDiffTypeDropdown value={lineDiffType} onChange={setLineDiffType} />
      <button
        type="button"
        className="pid-diff-toolbar-btn"
        data-active={layout === "split" || undefined}
        onClick={() => setLayout(layout === "split" ? "unified" : "split")}
        // Two whole keys, never one key with the mode spliced in: the English reads the same
        // either way, so only a translation that has to reorder the words would expose the bug.
        aria-label={layout === "split" ? copy.switchToUnified() : copy.switchToSplit()}
        aria-pressed={layout === "split"}
        title={layout === "split" ? copy.layoutSplitTitle() : copy.layoutUnifiedTitle()}
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
        aria-label={background ? copy.backgroundDisable() : copy.backgroundEnable()}
        aria-pressed={background}
        title={background ? copy.backgroundOnTitle() : copy.backgroundOffTitle()}
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
 * Surface labels — Pierre's wire value `char` becomes the user-friendly "Character" here.
 *
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * `value` stays the wire value Pierre expects.
 *
 * Exported for `test/i18n/option-tables.test.ts`, which calls it with a sentinel translations
 * object so a label that comes back as a literal fails there.
 */
export function lineDiffOptions(t: TranslationFunctions): readonly LineDiffOption[] {
  const copy = t.diff.toolbar.lineDiff;
  return [
    { value: "word-alt", label: copy.wordAlt.label(), description: copy.wordAlt.description() },
    { value: "word", label: copy.word.label(), description: copy.word.description() },
    { value: "char", label: copy.char.label(), description: copy.char.description() },
    { value: "none", label: copy.none.label(), description: copy.none.description() },
  ];
}

function labelFor(t: TranslationFunctions, value: DiffLineDiffType): string {
  return lineDiffOptions(t).find((o) => o.value === value)?.label ?? value;
}

interface LineDiffTypeDropdownProps {
  value: DiffLineDiffType;
  onChange: (value: DiffLineDiffType) => void;
}

function LineDiffTypeDropdown({ value, onChange }: LineDiffTypeDropdownProps) {
  const { LL } = useI18nContext();
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-diff-toolbar-select"
          aria-label={LL.diff.toolbar.highlight()}
          title={LL.diff.toolbar.highlight()}
        >
          <span className="pid-diff-toolbar-select-label">{labelFor(LL, value)}</span>
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
            {lineDiffOptions(LL).map((opt) => (
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
