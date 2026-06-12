import { autocompletion } from "@codemirror/autocomplete";
import { lintGutter } from "@codemirror/lint";
import { Compartment, type Extension } from "@codemirror/state";
import { tooltips } from "@codemirror/view";
import { languageIdForFile, serverForLanguageId } from "@pi-deck/core/lsp/server-defs.js";
import { deckPathToUri } from "@pi-deck/core/lsp/uri.js";
import { currentCustomLspDefs } from "./useLspCustomServersStore.js";
import { lspClientFor, useLspStore } from "./useLspStore.js";

/**
 * Per-tab slot for language assistance. Holds either the plain built-in `autocompletion()`
 * (no server: unsupported language, missing binary, crash fallback) or the LSP plugin for the
 * tab's file, which carries the client-configured feature set (server completion, hover,
 * signature help, diagnostics, rename/definition/references keymaps).
 */
export const lspCompartment = new Compartment();

/**
 * Completion/hover/signature popovers are CodeMirror tooltips; parent them to `document.body`
 * so they portal above the `.pid-app::before` grain (App-shell overlay rule).
 */
const tooltipParent = tooltips({ parent: document.body });

export interface LanguageAssistTab {
  projectId: string;
  fileName: string;
  absPath: string;
}

/** Current best content for the LSP compartment of a tab, given live server state. */
export function languageAssist(tab: LanguageAssistTab): Extension {
  const custom = currentCustomLspDefs();
  const languageId = languageIdForFile(tab.fileName, custom);
  const def = languageId ? serverForLanguageId(languageId, custom) : null;
  if (languageId && def) {
    const key = `${tab.projectId}:${def.id}`;
    const server = useLspStore.getState().servers[key];
    const client = lspClientFor(key);
    if (server?.status === "ready" && server.mapping && client) {
      const uri = deckPathToUri(tab.absPath, server.mapping);
      // `client.plugin` bundles the editor extensions configured on the client
      // (languageServerExtensions(): completion incl. the autocompletion UI, hover,
      // signature help, diagnostics auto-sync, feature keymaps). The lint gutter gives
      // the published diagnostics a per-line marker next to the line numbers.
      if (uri) return [tooltipParent, lintGutter(), client.plugin(uri, languageId)];
    }
  }
  return [tooltipParent, autocompletion()];
}
