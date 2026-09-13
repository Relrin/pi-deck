import { LOCALES } from "@pi-deck/core";
import { PidButton } from "../../../components/buttons/PidButton";
import { useI18nContext } from "../../../i18n/i18n-react";
import type { TranslationFunctions } from "../../../i18n/i18n-types";
import { LOCALE_META } from "../../../i18n/locale-meta";
import { useLocaleStore } from "../../../i18n/useLocaleStore";
import { useRailState } from "../../../layout/use-rail-state";
import { useRightPaneStore } from "../../../layout/use-right-pane";
import { useNavStore } from "../../../lib/useNavStore";
import {
  type Density,
  type FontPair,
  type TerminalWidth,
  usePreferencesStore,
  type ViewMode,
} from "../../../theme/usePreferencesStore";
import { useThemeStore } from "../../../theme/useThemeStore";
import { pushAgentLanguageToAll } from "../../sessions/agent-language";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { ImportThemeButton } from "../ImportThemeButton";
import { ThemePreviewCard } from "../ThemePreviewCard";

/**
 * Built per render rather than held as module constants: a module-level table would capture
 * whatever locale was loaded at import time and never update on a language switch. Every `value`
 * here is persisted preference state and stays an identifier.
 */
export function viewOptions(t: TranslationFunctions): Array<{ value: ViewMode; label: string }> {
  return [
    { value: "agent", label: t.settings.appearance.view.agent() },
    { value: "ide", label: t.settings.appearance.view.ide() },
  ];
}

export function densityOptions(t: TranslationFunctions): Array<{ value: Density; label: string }> {
  return [
    { value: "compact", label: t.settings.appearance.density.compact() },
    { value: "cozy", label: t.settings.appearance.density.cozy() },
  ];
}

export function fontOptions(t: TranslationFunctions): Array<{ value: FontPair; label: string }> {
  return [
    { value: "default", label: t.settings.appearance.fonts.default() },
    { value: "sans-only", label: t.settings.appearance.fonts.sansOnly() },
    { value: "mono-only", label: t.settings.appearance.fonts.monoOnly() },
  ];
}

// Ordered spatially (left → right → all) so the segmented control reads like the layout it
// describes. `center` is the default and sits in the middle.
export function terminalWidthOptions(
  t: TranslationFunctions,
): Array<{ value: TerminalWidth; label: string }> {
  const copy = t.settings.appearance.terminalWidth;
  return [
    { value: "center-left", label: copy.centerLeft() },
    { value: "center", label: copy.center() },
    { value: "center-right", label: copy.centerRight() },
    { value: "all", label: copy.all() },
  ];
}

/**
 * Language options come from `LOCALE_META`, not a literal table. Each label is the language's own
 * name, which never gets translated — a picker that says "Russian" is no help to someone who
 * cannot read English. Adding a locale is therefore a `LOCALE_META` change only.
 */
const LANGUAGE_OPTIONS = LOCALES.map((value) => ({ value, label: LOCALE_META[value].nativeName }));

export function AppearanceSection() {
  const { LL } = useI18nContext();
  const uiLocale = useLocaleStore((s) => s.uiLocale);
  const setUiLocale = useLocaleStore((s) => s.setUiLocale);

  const client = useSessionsStore((s) => s.client);
  const sessions = useSessionsStore((s) => s.sessions);
  const available = useThemeStore((s) => s.available);
  const activeName = useThemeStore((s) => s.activeName);
  const setActiveTheme = useThemeStore((s) => s.setActive);

  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const fonts = usePreferencesStore((s) => s.fonts);
  const setFonts = usePreferencesStore((s) => s.setFonts);
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const setViewMode = usePreferencesStore((s) => s.setViewMode);
  const terminalWidth = usePreferencesStore((s) => s.terminalWidth);
  const setTerminalWidth = usePreferencesStore((s) => s.setTerminalWidth);

  function handleSelectTheme(name: string) {
    if (!client) return;
    void setActiveTheme(client, name);
  }

  // Toggling the layout coordinates the sibling layout stores once, at the click:
  // IDE docks the chat (focus its tab) and pulls the center off the now-docked session
  // route; switching back drops the chat tab so the right pane shows Git again.
  function handleViewMode(next: ViewMode) {
    if (next === viewMode) return;
    setViewMode(next);
    if (next === "ide") {
      // The chat is docked in the right pane — make sure it's actually on screen.
      useRailState.getState().setRightVisible(true);
      useRightPaneStore.getState().setTab("chat");

      const screen = useNavStore.getState().screen;
      if (screen === "session" || screen === "blank") {
        useNavStore.getState().setScreen("editor");
      }
    } else if (useRightPaneStore.getState().tab === "chat") {
      useRightPaneStore.getState().setTab("git");
    }
  }

  return (
    <div className="pid-settings-panel-inner">
      <header>
        <div className="pid-settings-section-kicker">
          {LL.settings.kicker({ section: LL.settings.appearance.kicker() })}
        </div>
        <h1 className="pid-settings-section-title">{LL.settings.appearance.title()}</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.appearance.theme.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.theme.desc()}</div>
        <div className="pid-theme-grid">
          {available.map((listing) => (
            <ThemePreviewCard
              key={listing.name}
              listing={listing}
              client={client}
              active={listing.name === activeName}
              onSelect={handleSelectTheme}
            />
          ))}
        </div>
        <div>
          <ImportThemeButton />
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.appearance.view.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.view.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.appearance.view.ariaLabel()}
        >
          {viewOptions(LL).map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={viewMode === option.value}
              active={viewMode === option.value}
              onClick={() => handleViewMode(option.value)}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.appearance.language.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.language.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.appearance.language.label()}
        >
          {LANGUAGE_OPTIONS.map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={uiLocale === option.value}
              active={uiLocale === option.value}
              onClick={() => {
                // With the agent language left at "Match interface", this is what changes it —
                // the host resolves `match-ui` against the `uiLocale` it was last handed.
                void setUiLocale(option.value).then(() => {
                  if (client) return pushAgentLanguageToAll(client, sessions);
                });
              }}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.language.hint()}</div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.appearance.density.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.density.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.appearance.density.ariaLabel()}
        >
          {densityOptions(LL).map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={density === option.value}
              active={density === option.value}
              onClick={() => setDensity(option.value)}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">{LL.settings.appearance.fonts.label()}</div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.fonts.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.appearance.fonts.ariaLabel()}
        >
          {fontOptions(LL).map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={fonts === option.value}
              active={fonts === option.value}
              onClick={() => setFonts(option.value)}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
      </section>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">
          {LL.settings.appearance.terminalWidth.label()}
        </div>
        <div className="pid-settings-block-desc">{LL.settings.appearance.terminalWidth.desc()}</div>
        <div
          className="pid-segmented"
          role="radiogroup"
          aria-label={LL.settings.appearance.terminalWidth.ariaLabel()}
        >
          {terminalWidthOptions(LL).map((option) => (
            <PidButton
              key={option.value}
              role="radio"
              aria-checked={terminalWidth === option.value}
              active={terminalWidth === option.value}
              onClick={() => setTerminalWidth(option.value)}
            >
              {option.label}
            </PidButton>
          ))}
        </div>
      </section>
    </div>
  );
}
