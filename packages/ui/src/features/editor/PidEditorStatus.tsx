import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { ConfirmDialog } from "../../components/dialogs/ConfirmDialog.js";
import { Check } from "../../components/icons/index.js";
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

/** Curated reopen-with encodings (label → iconv-lite name). */
const ENCODINGS: { name: string; label: string }[] = [
  { name: "utf-8", label: "UTF-8" },
  { name: "utf-16le", label: "UTF-16 LE" },
  { name: "utf-16be", label: "UTF-16 BE" },
  { name: "win1252", label: "Western (Windows-1252)" },
  { name: "latin1", label: "Western (ISO-8859-1)" },
  { name: "ascii", label: "US-ASCII" },
];

const EOLS: { value: Eol; label: string; hint: string }[] = [
  { value: "lf", label: "LF", hint: "Unix (\\n)" },
  { value: "crlf", label: "CRLF", hint: "Windows (\\r\\n)" },
];

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

function lspTitle(server: LspServerState): string {
  switch (server.status) {
    case "ready":
      return "Language server connected";
    case "starting":
      return "Language server starting…";
    case "missing":
      return server.installHint
        ? `Language server not installed — ${server.installHint}`
        : "Language server not installed";
    case "crashed":
      return `Language server crashed — ${server.message ?? "reopen the file to retry"}`;
    case "disabled":
      return "Language server disabled in Settings → Editor";
  }
}

/**
 * Status segments for the active editor tab — rendered in the footer's right region (after the
 * spacer) only while the editor screen is active. Three segments are interactive: the cursor
 * position opens a Go-to-Line modal, and the encoding / line-ending chips open menus to reopen
 * the file in another encoding (with optional BOM) or switch the line separator.
 */
export function PidEditorStatus() {
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
    ? `Tab Size: ${tab.indentWidth}`
    : `Spaces: ${tab.indentWidth}`;
  const encodingLabel =
    (ENCODINGS.find((e) => e.name === tab.encoding)?.label ?? tab.encoding.toUpperCase()) +
    (tab.bom ? " · BOM" : "");

  const chooseEncoding = (name: string) => {
    if (name === tab.encoding) return;
    if (tab.dirty) setPendingEncoding(name);
    else setEncoding(tab.id, name);
  };

  return (
    <>
      {lspDiag && (lspDiag.errors > 0 || lspDiag.warnings > 0) ? (
        <div className="seg" title="Language-server diagnostics in this file">
          {lspDiag.errors > 0 ? (
            <span style={{ color: "var(--del)" }}>✕ {lspDiag.errors}</span>
          ) : null}
          {lspDiag.warnings > 0 ? (
            <span style={{ color: "var(--warn)" }}>▲ {lspDiag.warnings}</span>
          ) : null}
        </div>
      ) : null}

      {lspServer ? (
        <div className="seg" title={lspTitle(lspServer)}>
          <span aria-hidden style={{ color: lspDotColor(lspServer.status) }}>
            ●
          </span>
          <span className="lbl">LSP</span>
        </div>
      ) : null}

      <button
        type="button"
        className="seg seg-btn"
        onClick={() => setGotoOpen(true)}
        title="Go to line / column"
      >
        <span>
          Ln {cursor.line}, Col {cursor.col}
        </span>
        {cursor.selLen > 0 ? <span className="lbl">({cursor.selLen} selected)</span> : null}
      </button>

      <div className="seg">
        <span>{indentLabel}</span>
      </div>

      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button type="button" className="seg seg-btn" title="Select encoding (reopens the file)">
            <span>{encodingLabel}</span>
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content side="top" align="end" sideOffset={6} className="pid-footer-menu">
            <RadixDropdown.Label className="pid-footer-menu-head">
              Reopen with Encoding
            </RadixDropdown.Label>
            {ENCODINGS.map((e) => (
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
              <span>Add BOM</span>
            </RadixDropdown.CheckboxItem>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>

      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button type="button" className="seg seg-btn" title="Select line separator">
            <span>{eolLabel(tab.eol)}</span>
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content side="top" align="end" sideOffset={6} className="pid-footer-menu">
            {EOLS.map((e) => (
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
        title="Reopen with different encoding?"
        description="This file has unsaved changes. Reopening it in another encoding will discard them."
        confirmLabel="Discard & reopen"
        destructive
        onConfirm={() => {
          if (pendingEncoding) setEncoding(tab.id, pendingEncoding);
          setPendingEncoding(null);
        }}
      />
    </>
  );
}
