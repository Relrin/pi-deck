/**
 * Strings for `features/editor/`.
 *
 * Three categories in this directory are **not** copy and stay out of the catalog:
 *
 * - `languages.ts`'s ~60 `label` values (`TypeScript`, `Rust`, `Protocol Buffers`). They are
 *   language names shown in the status bar — proper nouns, and `tab.languageLabel` renders one
 *   verbatim.
 * - `eol.ts`'s `LF` / `CRLF`, and the encoding *names* (`utf-8`, `win1252`) that key `iconv-lite`.
 *   The encoding **labels** below are copy, because "Western (Windows-1252)" describes the
 *   encoding rather than naming it.
 * - Language-server ids, executables and their `npm install -g …` hints — see `lsp.presets`.
 *
 * CodeMirror's own search and lint panels stay English: they are localizable only through the
 * `EditorState.phrases` facet, which is real work and deliberately deferred (a documented island).
 */
const editor = {
  /** `PidEditorView.tsx` — nothing open yet. */
  empty: {
    title: "No file open",
    hint: "Select a file in the tree to open it here.",
  },

  /** `CodeMirrorEditor.tsx`'s overlays, shown in place of the document. */
  overlay: {
    loading: "Loading…",
    openFailed: "Failed to open file",
    binary: "Binary file — not shown.",
    tooLarge: "File is too large to open in the editor.",
  },

  /** `PidEditorTabBar.tsx`. `{name}` is a file name and passes through untranslated. */
  tabs: {
    label: "Open files",
    unsaved: "Unsaved changes",
    close: "Close {name:string}",
    overflow: "{count:number} more open {{file|files}}",
  },

  /** `PidEditorStatus.tsx` — the footer segments for the active tab. */
  status: {
    gotoTitle: "Go to line / column",
    /** `Ln 12, Col 4`. Both numbers are positions, not counts, so no plural. */
    cursor: "Ln {line:number}, Col {col:number}",
    selected: "({count:number} selected)",
    indentTabs: "Tab Size: {width:number}",
    indentSpaces: "Spaces: {width:number}",
    encodingTitle: "Select encoding (reopens the file)",
    encodingMenuHead: "Reopen with Encoding",
    /** Appended to the encoding chip when the file carries a byte-order mark. */
    bomSuffix: " · BOM",
    addBom: "Add BOM",
    eolTitle: "Select line separator",
    eolHintLf: "Unix (\\n)",
    eolHintCrlf: "Windows (\\r\\n)",
    reopenConfirmTitle: "Reopen with different encoding?",
    reopenConfirmBody:
      "This file has unsaved changes. Reopening it in another encoding will discard them.",
    reopenConfirmLabel: "Discard & reopen",
    /** Encoding menu labels. The `name` each maps to is an iconv-lite id and is not copy. */
    encoding: {
      utf8: "UTF-8",
      utf16le: "UTF-16 LE",
      utf16be: "UTF-16 BE",
      win1252: "Western (Windows-1252)",
      latin1: "Western (ISO-8859-1)",
      ascii: "US-ASCII",
    },
  },

  /** `PidGotoLineDialog.tsx`. The placeholder's `120:8` is an example, not copy. */
  goto: {
    title: "Go to Line:Column",
    description: "Enter a line number, or line:column.",
    placeholder: "e.g. 120 or 120:8",
    label: "Line and column",
    submit: "Go",
  },

  /** `PidDiffBlockToolbar.tsx` — the floating per-block controls inside a diffed document. */
  blockToolbar: {
    label: "Diff block actions",
    prev: "Previous change",
    next: "Next change",
    revert: "Revert this block",
    showDiff: "Show Diff for lines",
  },

  /**
   * `PidDiffMinimap.tsx`.
   *
   * Two complete key sets rather than one plus `.toLowerCase()`. The English happened to work
   * because "Added" lower-cases to "добавлено"'s slot cleanly; in a language with cases the
   * mid-sentence form is a different word, not a different capitalisation, and no amount of
   * string surgery recovers it.
   */
  minimap: {
    jumpTo: {
      add: "Jump to added change",
      mod: "Jump to modified change",
      del: "Jump to removed change",
    },
    kind: {
      add: "Added change",
      mod: "Modified change",
      del: "Removed change",
    },
  },

  /**
   * Language-server surfaces. Server **ids**, executables, arguments and the shell commands in
   * their install hints are configuration, not copy — a translated `npm install -g …` would not
   * run. Only the sentences wrapped around them are here.
   */
  lsp: {
    status: {
      ready: "Language server connected",
      starting: "Language server starting…",
      missing: "Language server not installed",
      missingWithHint: "Language server not installed — {hint:string}",
      crashed: "Language server crashed — {reason:string}",
      crashedFallback: "reopen the file to retry",
      disabled: "Language server disabled in Settings → Editor",
      diagnostics: "Language-server diagnostics in this file",
    },
    /**
     * `AddCustomLspServerDialog.tsx`. The `PRESETS` table it renders — server names, commands,
     * arguments, extensions and `npm install -g …` hints — is configuration and stays out of the
     * catalog; only the chrome around it is here. So are the field placeholders, which are worked
     * examples (`elixir-ls`, `--stdio`, `cs install metals`) rather than prose.
     */
    dialog: {
      addTitle: "Add language server",
      editTitle: "Edit {label:string}",
      description:
        "The command is resolved on the project environment's PATH, exactly like the built-in servers — nothing is downloaded.",
      presetLabel: "Start from a preset (optional)",
      presetBlank: "Blank",
      fieldLabel: "Label",
      fieldId: "Id",
      fieldIdHint: "Lowercase letters, digits, hyphens. Can't collide with a built-in server id.",
      fieldCommand: "Command",
      fieldArgs: "Arguments (optional)",
      fieldLanguageIds: "Language ids",
      /** Spliced with a `<code>languageId</code>` element through `i18n/rich.tsx`. */
      fieldLanguageIdsHint: "LSP {code:string}s the server understands, space-separated.",
      fieldExtensions: "File extensions",
      /** Two spliced `<code>` elements: a bare extension and a qualified one. */
      fieldExtensionsHint:
        "No dots. A bare {bare:string} maps to the first language id; {qualified:string} picks another.",
      fieldInstallHint: "Install hint (optional)",
      fieldInstallHintHint: "Shown when the command isn't found on PATH.",
      submitting: "Saving…",
      saveChanges: "Save changes",
      addServer: "Add server",
      saveFailed: "Failed to save server",
    },

    /** `{server}` is a language-server id and stays as it is. */
    crashToast: {
      title: "{server:string} language server crashed",
      body: "The editor fell back to basic completion. Reopen a file to retry.",
    },
  },

  /** Fallbacks passed to `humanizeError(err, …)` and one direct status message. */
  errors: {
    save: "Failed to save file",
    open: "Failed to open file",
    notConnected: "Not connected",
  },
} as const;

export default editor;
