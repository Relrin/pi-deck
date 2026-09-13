import { useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { ArrowUpFromLine } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react";
import { useNotificationStore } from "../_status/useNotificationStore";
import { useSessionsStore } from "../sessions/useSessionsStore";

export function ImportThemeButton() {
  const { LL } = useI18nContext();
  const client = useSessionsStore((s) => s.client);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || !client) return;
    const picker = window.bridge?.openFile;
    if (!picker) {
      useNotificationStore.getState().error(LL.settings.errors.filePickerUnavailable());
      return;
    }
    setBusy(true);
    try {
      const path = await picker({
        filters: [{ name: LL.settings.appearance.theme.fileFilter(), extensions: ["json"] }],
      });
      if (!path) return;
      const result = await client.themes.import(path);
      useNotificationStore
        .getState()
        .success(LL.settings.appearance.theme.imported({ name: result.name }));
    } catch (err) {
      const message = err instanceof Error ? err.message : LL.settings.errors.importTheme();
      useNotificationStore.getState().error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PidButton
      variant="ghost"
      icon={<ArrowUpFromLine size={14} />}
      onClick={handleClick}
      disabled={busy || !client}
    >
      {busy ? LL.settings.appearance.theme.importing() : LL.settings.appearance.theme.import()}
    </PidButton>
  );
}
