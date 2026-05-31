import {
  Diff,
  Image as ImageIcon,
  ListOrdered,
  SquareChartGantt,
  SquareMenu,
  WrapText,
} from "lucide-react";
import type { ReactNode } from "react";
import { PidSegmentedPill } from "../../../components/segmented/PidSegmentedPill";
import { PidTogglePill } from "../../../components/segmented/PidTogglePill";
import { type DiffIndicators, usePreferencesStore } from "../../../theme/usePreferencesStore";
import { DiffView } from "../../diff/DiffView";

/**
 * The Git & GitHub settings tab. Hosts everything diff-and-PR-shaped
 * that isn't theme-level.
 */

interface IndicatorOption {
  value: DiffIndicators;
  label: string;
  description: string;
  icon: ReactNode;
}

const DIFF_INDICATOR_OPTIONS: IndicatorOption[] = [
  {
    value: "bars",
    label: "Bars",
    description: "Thin coloured bar at the row's leading edge, no full-width background.",
    icon: <SquareMenu size={12} aria-hidden />,
  },
  {
    value: "classic",
    label: "Classic",
    description: "+ / − markers in the gutter with full-width add/del background.",
    icon: <Diff size={12} aria-hidden />,
  },
  {
    value: "none",
    label: "None",
    description: "No markers, no background. Cleanest read for prose-heavy diffs.",
    icon: <SquareChartGantt size={12} aria-hidden />,
  },
];

/**
 * Tiny unified-diff snippet shown in the live preview. Kept inline so the preview
 * always renders the same hand-picked example regardless of project state — the
 * goal is "see what the choice looks like", not "preview your current code".
 */
const PREVIEW_PATCH = [
  "--- a/example.ts",
  "+++ b/example.ts",
  "@@ -1,4 +1,5 @@",
  " export function greet(name: string) {",
  '-  return "Hello, " + name;',
  "+  const trimmed = name.trim();",
  '+  return "Hello, " + trimmed + "!";',
  " }",
  "",
].join("\n");

export function GitGitHubSection() {
  const diffIndicators = usePreferencesStore((s) => s.diffIndicators);
  const setDiffIndicators = usePreferencesStore((s) => s.setDiffIndicators);
  const diffBackground = usePreferencesStore((s) => s.diffBackground);
  const setDiffBackground = usePreferencesStore((s) => s.setDiffBackground);
  const diffLineNumbers = usePreferencesStore((s) => s.diffLineNumbers);
  const setDiffLineNumbers = usePreferencesStore((s) => s.setDiffLineNumbers);
  const diffLineWrap = usePreferencesStore((s) => s.diffLineWrap);
  const setDiffLineWrap = usePreferencesStore((s) => s.setDiffLineWrap);

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">Settings · Git & GitHub</div>
        <h1 className="pid-settings-section-title">Git & GitHub</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Diff line style</div>
        <div className="pid-settings-block-desc">
          How added and removed lines are marked in the diff viewer.
        </div>
        <PidSegmentedPill
          ariaLabel="Diff line style"
          value={diffIndicators}
          options={DIFF_INDICATOR_OPTIONS}
          onChange={setDiffIndicators}
        />
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Diff display</div>
        <div className="pid-settings-block-desc">
          Independent on/off toggles applied to every diff view in the app.
        </div>
        <div className="pid-toggle-pill-row">
          <PidTogglePill
            label="Backgrounds"
            description="Full-width add/del row background."
            icon={<ImageIcon size={12} aria-hidden />}
            checked={diffBackground}
            onChange={setDiffBackground}
          />
          <PidTogglePill
            label="Line Numbers"
            description="Show the line-number gutter."
            icon={<ListOrdered size={12} aria-hidden />}
            checked={diffLineNumbers}
            onChange={setDiffLineNumbers}
          />
          <PidTogglePill
            label="Wrapping"
            description="Wrap long lines instead of horizontal scrolling."
            icon={<WrapText size={12} aria-hidden />}
            checked={diffLineWrap}
            onChange={setDiffLineWrap}
          />
        </div>
        <div className="pid-diff-preview">
          <DiffView unified={PREVIEW_PATCH} layout="unified" wordHighlight />
        </div>
      </section>
    </div>
  );
}
