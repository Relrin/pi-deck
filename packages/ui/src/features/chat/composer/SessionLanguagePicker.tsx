import type { AgentLanguage } from "@pi-deck/core";
import { LOCALES } from "@pi-deck/core";
import { Languages } from "../../../components/icons/index.js";
import {
  PidChipPicker,
  type PidChipPickerOption,
} from "../../../components/picker/PidChipPicker.js";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import { LOCALE_META } from "../../../i18n/locale-meta.js";
import { useLocaleStore } from "../../../i18n/useLocaleStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

interface SessionLanguagePickerProps {
  sessionId: string;
}

/**
 * Per-session override for the language the agent writes in.
 *
 * Modelled on `SessionEffortPicker`: a chip picker bound to per-session state that pushes straight
 * to the host. The default option follows the global Agents & Models setting, so most users never
 * touch this — it is here for the case where one session needs a different language from the rest.
 */
export function SessionLanguagePicker({ sessionId }: SessionLanguagePickerProps) {
  const { LL } = useI18nContext();
  const client = useSessionsStore((s) => s.client);
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === sessionId));
  const globalDefault = useLocaleStore((s) => s.agentLanguage);
  const uiLocale = useLocaleStore((s) => s.uiLocale);

  // The session's own pick wins; otherwise it inherits the global preference.
  const activeValue: AgentLanguage = session?.agentLanguage ?? globalDefault;

  const options: PidChipPickerOption[] = [
    { value: "match-ui", label: LL.settings.agents.responseLanguage.matchUi() },
    ...LOCALES.map((value) => ({ value, label: LOCALE_META[value].nativeName })),
  ];

  const activeLabel =
    activeValue === "match-ui"
      ? LL.settings.agents.responseLanguage.matchUi()
      : LOCALE_META[activeValue].nativeName;

  return (
    <PidChipPicker
      triggerLeading={<Languages size={12} className="pid-picker-trigger-icon" aria-hidden />}
      header={LL.chat.languagePicker.label()}
      ariaLabel={LL.chat.languagePicker.label()}
      value={activeValue}
      options={options}
      onChange={(v) => {
        // `uiLocale` travels with the request so the host can resolve `match-ui` in one place
        // rather than every caller doing it differently.
        void client?.call("session.setAgentLanguage", {
          sessionId,
          language: v as AgentLanguage,
          uiLocale,
        });
      }}
      triggerLabel={activeLabel}
      minPopoverWidth={130}
    />
  );
}
