import { useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { useToastStore } from "../_status/useToastStore";
import { useSessionsStore } from "../sessions/useSessionsStore";

export function ImportThemeButton() {
  const client = useSessionsStore((s) => s.client);
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy || !client) return;
    const picker = window.bridge?.openFile;
    if (!picker) {
      useToastStore.getState().push("File picker is unavailable in this build", "error");
      return;
    }
    setBusy(true);
    try {
      const path = await picker({ filters: [{ name: "JSON theme", extensions: ["json"] }] });
      if (!path) return;
      const result = await client.themes.import(path);
      useToastStore.getState().push(`Imported ${result.name}`, "info");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to import theme";
      useToastStore.getState().push(message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PidButton variant="ghost" glyph="upload" onClick={handleClick} disabled={busy || !client}>
      {busy ? "Importing…" : "Import VS Code theme…"}
    </PidButton>
  );
}
