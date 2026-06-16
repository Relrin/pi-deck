import { PidButton } from "../../../components/buttons/PidButton";
import { useRailState } from "../../../layout/use-rail-state";
import { useRightPaneStore } from "../../../layout/use-right-pane";
import { useNavStore } from "../../../lib/useNavStore";
import {
  type Density,
  type FontPair,
  usePreferencesStore,
  type ViewMode,
} from "../../../theme/usePreferencesStore";
import { useThemeStore } from "../../../theme/useThemeStore";
import { useSessionsStore } from "../../sessions/useSessionsStore";
import { ImportThemeButton } from "../ImportThemeButton";
import { ThemePreviewCard } from "../ThemePreviewCard";

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: "agent", label: "Agent" },
  { value: "ide", label: "IDE" },
];

const DENSITY_OPTIONS: Array<{ value: Density; label: string }> = [
  { value: "compact", label: "Compact" },
  { value: "cozy", label: "Cozy" },
];

const FONT_OPTIONS: Array<{ value: FontPair; label: string }> = [
  { value: "default", label: "Default (serif + sans + mono)" },
  { value: "sans-only", label: "Sans only" },
  { value: "mono-only", label: "Mono only" },
];

export function AppearanceSection() {
  const client = useSessionsStore((s) => s.client);
  const available = useThemeStore((s) => s.available);
  const activeName = useThemeStore((s) => s.activeName);
  const setActiveTheme = useThemeStore((s) => s.setActive);

  const density = usePreferencesStore((s) => s.density);
  const setDensity = usePreferencesStore((s) => s.setDensity);
  const fonts = usePreferencesStore((s) => s.fonts);
  const setFonts = usePreferencesStore((s) => s.setFonts);
  const viewMode = usePreferencesStore((s) => s.viewMode);
  const setViewMode = usePreferencesStore((s) => s.setViewMode);

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
        <div className="pid-settings-section-kicker">Settings · Appearance</div>
        <h1 className="pid-settings-section-title">Appearance</h1>
      </header>

      <section className="pid-settings-block">
        <div className="pid-settings-block-label">Theme</div>
        <div className="pid-settings-block-desc">
          Pick a bundled theme or drop a VS Code theme JSON into your themes folder.
        </div>
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
        <div className="pid-settings-block-label">View</div>
        <div className="pid-settings-block-desc">
          Agent keeps the linear session → editor → diff flow. IDE docks the chat beside the editor
          as a right-pane tab.
        </div>
        <div className="pid-segmented" role="radiogroup" aria-label="View mode">
          {VIEW_OPTIONS.map((option) => (
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
        <div className="pid-settings-block-label">Density</div>
        <div className="pid-settings-block-desc">
          Affects row heights, topbar/footer height, and base type size.
        </div>
        <div className="pid-segmented" role="radiogroup" aria-label="Density">
          {DENSITY_OPTIONS.map((option) => (
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
        <div className="pid-settings-block-label">Fonts</div>
        <div className="pid-settings-block-desc">
          Swap the display/UI/mono triad for a single-family aesthetic.
        </div>
        <div className="pid-segmented" role="radiogroup" aria-label="Fonts">
          {FONT_OPTIONS.map((option) => (
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
    </div>
  );
}
