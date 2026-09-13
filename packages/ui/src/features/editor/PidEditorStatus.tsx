import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { Check } from "../../components/icons/index.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import type { TranslationFunctions } from "../../i18n/i18n-types.js";
import { useProjectsStore } from "../sessions/useProjectsStore.js";
import { type Eol, eolLabel } from "./eol.js";
import {
  type LspServerState,
  selectTabDiagnostics,
  selectTabServer,
  useLspStore,
} from "./lsp/useLspStore.js";
import { PidGotoLineDialog } from "./PidGotoLineDialog.js";
import { selectActiveTab, useEditorStore } from "./useEditorStore.js";

/**
 * Curated reopen-with encodings. `name` is the iconv-lite id and is never translated; the label
 * *describes* the encoding rather than naming it, so it is.
 *
 * Built per render from the catalog rather than held as a module constant: a module-level table
 * would capture whatever locale was loaded at import time and never update on a language switch.
 * Exported for `test/i18n/option-tables.test.ts`.
 */
export function encodingOptions(t: TranslationFunctions): { name: string; label: string }[] {
  const copy = t.editor.status.encoding;
  return [
    { name: "utf-8", label: copy.utf8() },
    { name: "utf-16le", label: copy.utf16le() },
    { name: "utf-16be", label: copy.utf16be() },
    { name: "win1252", label: copy.win1252() },
    { name: "latin1", label: copy.latin1() },
    { name: "ascii", label: copy.ascii() },
  ];
}

/** `LF` / `CRLF` name the separators themselves; only the platform hint beside them is copy. */
export function eolOptions(t: TranslationFunctions): { value: Eol; label: string; hint: string }[] {
  return [
    { value: "lf", label: "LF", hint: t.editor.status.eolHintLf() },
    { value: "crlf", label: "CRLF", hint: t.editor.status.eolHintCrlf() },
  ];
}

function lspDotColor(status: LspServerState["status"]): string {
  switch (status) {
    case "ready":
      return "var(--add)";
    case "starting":
      return "var(--warn)";
    case "crashed":
      return "var(--del)";
    default: // missing / disabled
      return "var(--ink-3)";
  }
}

function lspTitle(t: TranslationFunctions, server: LspServerState): string {
  const copy = t.editor.lsp.status;
  switch (server.status) {
    case "ready":
      return copy.ready();
    case "starting":
      return copy.starting();
    case "missing":
      // The install hint is a shell command and passes through untranslated.
      return server.installHint
        ? copy.missingWithHint({ hint: server.installHint })
        : copy.missing();
    case "crashed":
      return copy.crashed({ reason: server.message ?? copy.crashedFallback() });
    case "disabled":
      return copy.disabled();
  }
}

/**
 * Status segments for the active editor tab — rendered in the footer's right region (after the
 * spacer) only while the editor screen is active. Three segments are interactive: the cursor
 * position opens a Go-to-Line modal, and the encoding / line-ending chips open menus to reopen
 * the file in another encoding (with optional BOM) or switch the line separator.
 */
export function PidEditorStatus() {
  const { LL } = useI18nContext();
  const projectId = useProjectsStore((s) => s.activeProjectId);
  const tab = useEditorStore(selectActiveTab(projectId));
  const setEol = useEditorStore((s) => s.setEol);
  const setBom = useEditorStore((s) => s.setBom);
  const setEncoding = useEditorStore((s) => s.setEncoding);
  const lspServer = useLspStore(selectTabServer(tab));
  const lspDiag = useLspStore(selectTabDiagnostics(tab));

  const [gotoOpen, setGotoOpen] = useState(false);
  // When the tab has unsaved edits, reopening would discard them — stash the choice and confirm.
  const [pendingEncoding, setPendingEncoding] = useState<string | null>(null);

  if (!tab) return null;
  const { cursor } = tab;
  const indentLabel = tab.indentUseTabs
    ? LL.editor.status.indentTabs({ width: tab.indentWidth })
    : LL.editor.status.indentSpaces({ width: tab.indentWidth });
  const encodingLabel =
    (encodingOptions(LL).find((e) => e.name === tab.encoding)?.label ??
      tab.encoding.toUpperCase()) + (tab.bom ? LL.editor.status.bomSuffix() : "");

  const chooseEncoding = (name: string) => {
    if (name === tab.encoding) return;
    if (tab.dirty) setPendingEncoding(name);
    else setEncoding(tab.id, name);
  };

  return (
    <>
      {lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0) ? (
        <div className="seg" title={LL.editor.lsp.status.diagnostics()}>
          {lspDiag.errors > 0 ? (
            <span style={{ color: "var(--del)" }}>✕ {lspDiag.errors}</span>
          ) : null}
          {lspDiag.warnings > 0 ? (
            <span style={{ color: "var(--warn)" }}>▲ {lspDiag.warnings}</span>
          ) : null}
        </div>
      ) : null}

      {lspServer ? (
        <div className="seg" title={lspTitle(LL, lspServer)}>
          <span aria-hidden style={{ color: lspDotColor(lspServer.status) }}>
            ●
          </span>
          {/* i18n-exempt: the protocol acronym, not a word */}
          <span className="lbl">LSP</span>
        </div>
      ) : null}

      <button
        type="button"
        className="seg seg-btn"
        onClick={() => setGotoOpen(true)}
        title={LL.editor.status.gotoTitle()}
      >
        <span>{LL.editor.status.cursor({ line: cursor.line, col: cursor.col })}</span>
        {cursor.selLen > 0 ? (
          <span className="lbl">{LL.editor.status.selected({ count: cursor.selLen })}</span>
        ) : null}
      </button>

      <div className="seg">
        <span>{indentLabel}</span>
      </div>

      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button type="button" className="seg seg-btn" title={LL.editor.status.encodingTitle()}>
            <span>{encodingLabel}</span>
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content side="top" align="end" sideOffset={6} className="pid-footer-menu">
            <RadixDropdown.Label className="pid-footer-menu-head">
              {LL.editor.status.encodingMenuHead()}
            </RadixDropdown.Label>
            {encodingOptions(LL).map((e) => (
              <RadixDropdown.Item
                key={e.name}
                className="pid-footer-menu-item"
                data-active={e.name === tab.encoding || undefined}
                onSelect={() => chooseEncoding(e.name)}
              >
                <span className="pid-footer-menu-check">
                  {e.name === tab.encoding ? <Check size={12} aria-hidden /> : null}
                </span>
                <span>{e.label}</span>
              </RadixDropdown.Item>
            ))}
            <RadixDropdown.Separator className="pid-footer-menu-sep" />
            <RadixDropdown.CheckboxItem
              className="pid-footer-menu-item"
              checked={tab.bom}
              onCheckedChange={(v) => setBom(tab.id, v === true)}
            >
              <span className="pid-footer-menu-check">
                {tab.bom ? <Check size={12} aria-hidden /> : null}
              </span>
              <span>{LL.editor.status.addBom()}</span>
            </RadixDropdown.CheckboxItem>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button type="button" className="seg seg-btn" title={LL.editor.status.eolTitle()}>
            <span>{eolLabel(tab.eol)}</span>
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content side="top" align="end" sideOffset={6} className="pid-footer-menu">
            {eolOptions(LL).map((e) => (
              <RadixDropdown.Item
                key={e.value}
                className="pid-footer-menu-item"
                data-active={e.value === tab.eol || undefined}
                onSelect={() => setEol(tab.id, e.value)}
              >
                <span className="pid-footer-menu-check">
                  {e.value === tab.eol ? <Check size={12} aria-hidden /> : null}
                </span>
                <span className="pid-footer-menu-label">{e.label}</span>
                <span className="pid-footer-menu-desc">{e.hint}</span>
              </RadixDropdown.Item>
            ))}
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

      <div className="seg">
        <span>{tab.languageLabel}</span>
      </div>

      <PidGotoLineDialog
        open={gotoOpen}
        onOpenChange={setGotoOpen}
        line={cursor.line}
        col={cursor.col}
      />
      <ConfirmDialog
        open={pendingEncoding !== null}
        onOpenChange={(o) => {
          if (!o) setPendingEncoding(null);
        }}
        title={LL.editor.status.reopenConfirmTitle()}
        description={LL.editor.status.reopenConfirmBody()}
        confirmLabel={LL.editor.status.reopenConfirmLabel()}
        destructive
        onConfirm={() => {
          if (pendingEncoding) setEncoding(tab.id, pendingEncoding);
          setPendingEncoding(null);
        }}
      />
    </>
  );
}
