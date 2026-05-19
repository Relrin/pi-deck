import { useEffect } from "react";
import { isMacOs } from "../../lib/platform";

interface AttachmentsHotkeysOpts {
  onChooseFiles: () => void;
  onChooseFolder: () => void;
}

/**
 * Window-level Cmd/Ctrl+O (file) and Cmd/Ctrl+Shift+O (folder) shortcuts for the intro
 * composer. Lives at window scope rather than on the textarea so the chords still fire
 * when focus is inside the attachments popover, the chip pickers, or anywhere else on
 * the composer screen — the kbd hints shown in the popover would otherwise be a lie.
 *
 * Intentionally does *not* suppress editable targets: ⌘O / ⌘⇧O have no plain-letter
 * collision, and we want them to work from the textarea too.
 */
export function useAttachmentsHotkeys(opts: AttachmentsHotkeysOpts): void {
  const { onChooseFiles, onChooseFolder } = opts;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const mod = isMacOs() ? event.metaKey : event.ctrlKey;
      if (!mod) return;
      if (event.altKey) return;
      if (event.key.toLowerCase() !== "o") return;
      event.preventDefault();
      if (event.shiftKey) onChooseFolder();
      else onChooseFiles();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onChooseFiles, onChooseFolder]);
}
