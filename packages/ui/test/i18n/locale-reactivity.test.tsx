import { afterEach, describe, expect, test } from "bun:test";
import { render as baseRender } from "@testing-library/react";
import type { ReactNode } from "react";
import { useI18nContext } from "../../src/i18n/i18n-react";
import { loadLocale } from "../../src/i18n/i18n-util.sync";
import { LocaleProvider } from "../../src/i18n/LocaleProvider";
import { ll } from "../../src/i18n/t";
import { useLocaleStore } from "../../src/i18n/useLocaleStore";
import { PidRightPane } from "../../src/layout/PidRightPane";
// `screen` must come from `test/utils`: the stock one binds to `document.body` at module-load
// time, which under bun's preload can happen before happy-dom registers the global document.
import { act, screen } from "../utils";

// `test/setup.ts` sync-loads only `en`. Never `mock.module` the i18n modules — they are
// process-global and unrevertable, and `bun test`'s file order is OS-dependent (sorted on Windows,
// readdir on Linux/CI), so a leak here would pass locally and fail only in CI.
loadLocale("ru");

/**
 * The regression guard for the most dangerous mistake in the string sweep.
 *
 * There are two ways to translate and picking the wrong one fails **silently**: a component that
 * reaches for the imperative `ll()` renders the right language on first paint and then goes stale
 * forever, because reading the store creates no subscription. Only `useI18nContext()` re-renders,
 * through `LocaleProvider`'s keyed remount.
 *
 * These render through `LocaleProvider` rather than the shared `render` from `test/utils`, whose
 * `AllProviders` hard-pins `locale="en"` deliberately so an ordinary test cannot leak a locale
 * switch into whichever file runs next.
 */
function renderWithLocale(ui: ReactNode) {
  return baseRender(<LocaleProvider>{ui}</LocaleProvider>);
}

/** Uses a key that really is translated, so a stale render is visible rather than masked. */
function TranslatedProbe() {
  const { LL } = useI18nContext();
  return <span data-testid="probe">{LL.plan.panel.inProgressFallback()}</span>;
}

function switchTo(locale: "en" | "ru") {
  act(() => {
    useLocaleStore.setState({ uiLocale: locale });
  });
}

describe("locale reactivity", () => {
  afterEach(() => {
    useLocaleStore.setState({ uiLocale: "en", agentLanguage: "match-ui" });
  });

  test("a component using useI18nContext re-renders with the new catalog", () => {
    renderWithLocale(<TranslatedProbe />);
    const english = screen.getByTestId("probe").textContent;
    expect(english).toBe("in progress");

    switchTo("ru");

    const russian = screen.getByTestId("probe").textContent;
    expect(russian).not.toBe(english);
    expect(russian).toBe(String(ll().plan.panel.inProgressFallback()));
  });

  test("switching back restores English, so the remount is not one-way", () => {
    renderWithLocale(<TranslatedProbe />);
    switchTo("ru");
    expect(screen.getByTestId("probe").textContent).not.toBe("in progress");
    switchTo("en");
    expect(screen.getByTestId("probe").textContent).toBe("in progress");
  });

  test("the imperative `ll()` tracks the store at call time", () => {
    // This is the contract `features/git/git-notify.ts` relies on: no subscription, but every call
    // reads the current locale, so a notification built after the switch is in the new language.
    const before = String(ll().plan.panel.inProgressFallback());
    switchTo("ru");
    const after = String(ll().plan.panel.inProgressFallback());
    expect(after).not.toBe(before);
  });

  test("shell labels survive a switch even though `shell` is untranslated", () => {
    // Per-key fallback: phase 04 ships English-only shell copy and phase 07 translates it. Until
    // then Russian must render the English string rather than a blank or a raw key path.
    renderWithLocale(<PidRightPane git={<div>git body</div>} context={<div>context body</div>} />);
    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe("Right pane tabs");

    switchTo("ru");

    expect(screen.getByRole("tablist").getAttribute("aria-label")).toBe("Right pane tabs");
    expect(screen.getByRole("tab", { name: /git/i })).toBeInTheDocument();
  });
});
