import {
  Ban,
  Baseline,
  Diff,
  Image as ImageIcon,
  ListOrdered,
  SquareChartGantt,
  SquareMenu,
  SquareSplitHorizontal,
  SquareSplitVertical,
  Type,
  WholeWord,
  WrapText,
} from "lucide-react";
import type { ReactNode } from "react";
import { PidSegmentedPill } from "../../../components/segmented/PidSegmentedPill";
import { PidTogglePill } from "../../../components/segmented/PidTogglePill";
import { useI18nContext } from "../../../i18n/i18n-react";
import type { TranslationFunctions } from "../../../i18n/i18n-types";
import {
  type DiffIndicators,
  type DiffLayout,
  type DiffLineDiffType,
  usePreferencesStore,
} from "../../../theme/usePreferencesStore";
import { DiffThemePicker } from "../../diff/DiffThemePicker";
import { DiffView } from "../../diff/DiffView";
import { DARK_DIFF_THEMES, LIGHT_DIFF_THEMES } from "../../diff/diffThemes";

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

/**
 * The three option tables below are built per render rather than held as module constants: a
 * module-level table would capture whatever locale was loaded at import time. Every `value` is a
 * persisted preference and stays an identifier.
 */
export function diffIndicatorOptions(t: TranslationFunctions): IndicatorOption[] {
  const copy = t.settings.git.lineStyle;
  return [
    {
      value: "bars",
      label: copy.bars.label(),
      description: copy.bars.description(),
      icon: <SquareMenu size={12} aria-hidden />,
    },
    {
      value: "classic",
      label: copy.classic.label(),
      description: copy.classic.description(),
      icon: <Diff size={12} aria-hidden />,
    },
    {
      value: "none",
      label: copy.none.label(),
      description: copy.none.description(),
      icon: <SquareChartGantt size={12} aria-hidden />,
    },
  ];
}

interface LayoutOption {
  value: DiffLayout;
  label: string;
  description: string;
  icon: ReactNode;
}

export function diffLayoutOptions(t: TranslationFunctions): LayoutOption[] {
  const copy = t.settings.git.layout;
  return [
    {
      value: "split",
      label: copy.split.label(),
      description: copy.split.description(),
      icon: <SquareSplitHorizontal size={12} aria-hidden />,
    },
    {
      value: "unified",
      label: copy.unified.label(),
      description: copy.unified.description(),
      icon: <SquareSplitVertical size={12} aria-hidden />,
    },
  ];
}

interface LineDiffOption {
  value: DiffLineDiffType;
  label: string;
  description: string;
  icon: ReactNode;
}

export function diffLineDiffOptions(t: TranslationFunctions): LineDiffOption[] {
  const copy = t.settings.git.lineDiff;
  return [
    {
      value: "word-alt",
      label: copy.wordAlt.label(),
      description: copy.wordAlt.description(),
      icon: <WholeWord size={12} aria-hidden />,
    },
    {
      value: "word",
      label: copy.word.label(),
      description: copy.word.description(),
      icon: <Type size={12} aria-hidden />,
    },
    {
      value: "char",
      label: copy.char.label(),
      description: copy.char.description(),
      icon: <Baseline size={12} aria-hidden />,
    },
    {
      value: "none",
      label: copy.none.label(),
      description: copy.none.description(),
      icon: <Ban size={12} aria-hidden />,
    },
  ];
}

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
  const { LL } = useI18nContext();
  const diffIndicators = usePreferencesStore((s) => s.diffIndicators);
  const setDiffIndicators = usePreferencesStore((s) => s.setDiffIndicators);
  const diffBackground = usePreferencesStore((s) => s.diffBackground);
  const setDiffBackground = usePreferencesStore((s) => s.setDiffBackground);
  const diffLineNumbers = usePreferencesStore((s) => s.diffLineNumbers);
  const setDiffLineNumbers = usePreferencesStore((s) => s.setDiffLineNumbers);
  const diffLineWrap = usePreferencesStore((s) => s.diffLineWrap);
  const setDiffLineWrap = usePreferencesStore((s) => s.setDiffLineWrap);
  const diffLayout = usePreferencesStore((s) => s.diffLayout);
  const setDiffLayout = usePreferencesStore((s) => s.setDiffLayout);
  const diffLineDiffType = usePreferencesStore((s) => s.diffLineDiffType);
  const setDiffLineDiffType = usePreferencesStore((s) => s.setDiffLineDiffType);
  const diffThemeLight = usePreferencesStore((s) => s.diffThemeLight);
  const setDiffThemeLight = usePreferencesStore((s) => s.setDiffThemeLight);
  const diffThemeDark = usePreferencesStore((s) => s.diffThemeDark);
  const setDiffThemeDark = usePreferencesStore((s) => s.setDiffThemeDark);

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.git.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.git.title()}</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.git.lineStyle.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.git.lineStyle.desc()}</div>
        <PidSegmentedPill
          ariaLabel={LL.settings.git.lineStyle.ariaLabel()}
          value={diffIndicators}
          options={diffIndicatorOptions(LL)}
          onChange={setDiffIndicators}
        />
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.git.layout.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.git.layout.desc()}</div>
        <PidSegmentedPill
          ariaLabel={LL.settings.git.layout.ariaLabel()}
          value={diffLayout}
          options={diffLayoutOptions(LL)}
          onChange={setDiffLayout}
        />
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.git.lineDiff.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.git.lineDiff.desc()}</div>
        <PidSegmentedPill
          ariaLabel={LL.settings.git.lineDiff.ariaLabel()}
          value={diffLineDiffType}
          options={diffLineDiffOptions(LL)}
          onChange={setDiffLineDiffType}
        />
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.git.display.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.git.display.desc()}</div>
        <div className="pid-toggle-pill-row">
          <PidTogglePill
            label={LL.settings.git.display.backgrounds.label()}
            description={LL.settings.git.display.backgrounds.description()}
            icon={<ImageIcon size={12} aria-hidden />}
            checked={diffBackground}
            onChange={setDiffBackground}
          />
          <PidTogglePill
            label={LL.settings.git.display.lineNumbers.label()}
            description={LL.settings.git.display.lineNumbers.description()}
            icon={<ListOrdered size={12} aria-hidden />}
            checked={diffLineNumbers}
            onChange={setDiffLineNumbers}
          />
          <PidTogglePill
            label={LL.settings.git.display.wrapping.label()}
            description={LL.settings.git.display.wrapping.description()}
            icon={<WrapText size={12} aria-hidden />}
            checked={diffLineWrap}
            onChange={setDiffLineWrap}
          />
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.git.themes.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.git.themes.desc()}</div>
        <div className="pid-diff-theme-grid">
          <DiffThemeCard
            kind="light"
            value={diffThemeLight}
            options={LIGHT_DIFF_THEMES}
            onChange={setDiffThemeLight}
          />
          <DiffThemeCard
            kind="dark"
            value={diffThemeDark}
            options={DARK_DIFF_THEMES}
            onChange={setDiffThemeDark}
          />
        </div>
      </section>
    </div>
  );
}

interface DiffThemeCardProps {
  kind: "light" | "dark";
  value: string;
  options: typeof LIGHT_DIFF_THEMES;
  onChange: (name: string) => void;
}

function DiffThemeCard({ kind, value, options, onChange }: DiffThemeCardProps) {
  const { LL } = useI18nContext();
  const copy = LL.settings.git.themes;
  return (
    // `kind` stays the raw identifier for `data-kind` — the stylesheet keys off it.
    <div className="pid-diff-theme-card" data-kind={kind}>
      <div className="pid-diff-theme-card-head">
        <span className="pid-mono-label">{kind === "light" ? copy.light() : copy.dark()}</span>
        <DiffThemePicker
          value={value}
          options={options}
          onChange={onChange}
          ariaLabel={kind === "light" ? copy.lightPicker() : copy.darkPicker()}
        />
      </div>
      <div className="pid-diff-theme-card-preview">
        <DiffView
          unified={PREVIEW_PATCH}
          layoutOverride="unified"
          lineDiffTypeOverride="word"
          themeOverride={value}
          forPreview
        />
      </div>
    </div>
  );
}
