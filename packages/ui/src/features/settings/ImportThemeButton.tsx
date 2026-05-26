import { useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { ArrowUpFromLine } from "../../components/icons/index.js";
import { useNotificationStore } from "../_status/useNotificationStore";
import { useSessionsStore } from "../sessions/useSessionsStore";

export function ImportThemeButton() {
  const client = useSessionsStore((s) => s.client);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || !client) return;
    const picker = window.bridge?.openFile;
    if (!picker) {
      useNotificationStore.getState().error("File picker is unavailable in this build");
      return;
    }
    setBusy(true);
    try {
      const path = await picker({ filters: [{ name: "JSON theme", extensions: ["json"] }] });
      if (!path) return;
      const result = await client.themes.import(path);
      useNotificationStore.getState().success(`Imported ${result.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import theme";
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
      {busy ? "Importing…" : "Import VS Code theme…"}
    </PidButton>
  );
}
