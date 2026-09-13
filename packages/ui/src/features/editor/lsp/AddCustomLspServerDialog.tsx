import type { CustomLspServer } from "@pi-deck/core/protocol/lsp.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
import { useI18nContext } from "../../../i18n/i18n-react.js";
import { rich, slot } from "../../../i18n/rich.js";
import { humanizeError } from "../../../lib/format/humanize-error.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";
import { useLspCustomServersStore } from "./useLspCustomServersStore.js";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** When set, the dialog edits this server instead of creating a new one (id locked). */
  editing?: CustomLspServer;
  onSaved?: () => void;
}

/**
 * Known-good configurations the user can start from. A preset only prefills the form —
 * the saved entry is a plain custom server, identical to a hand-typed one.
 */
// i18n-exempt: language-server configuration — names, executables, args, install commands
const PRESETS: { name: string; server: CustomLspServer }[] = [
  {
    name: "Elixir (elixir-ls)",
    server: {
      id: "elixir",
      label: "Elixir",
      languageIds: ["elixir", "eex", "phoenix-heex"],
      extensions: ["ex", "exs", "eex:eex", "heex:phoenix-heex"],
      command: "elixir-ls",
      args: [],
      installHint: "Install elixir-ls and expose its language_server script as `elixir-ls`",
    },
  },
  {
    name: "Erlang (erlang_ls)",
    server: {
      id: "erlang",
      label: "Erlang",
      languageIds: ["erlang"],
      extensions: ["erl", "hrl"],
      command: "erlang_ls",
      args: [],
      installHint: "Install erlang_ls (https://erlang-ls.github.io)",
    },
  },
  {
    name: "Scala (Metals)",
    server: {
      id: "scala",
      label: "Scala",
      languageIds: ["scala"],
      extensions: ["scala", "sbt", "sc"],
      command: "metals",
      args: [],
      installHint: "cs install metals (Coursier; requires a JDK)",
    },
  },
  {
    name: "C / C++ (clangd)",
    server: {
      id: "clangd",
      label: "C / C++",
      languageIds: ["c", "cpp"],
      extensions: ["c", "h:c", "cpp", "cc:cpp", "cxx:cpp", "hpp:cpp", "hh:cpp"],
      command: "clangd",
      args: [],
      installHint: "Install clangd (https://clangd.llvm.org/installation)",
    },
  },
  {
    name: "Java (jdtls)",
    server: {
      id: "java",
      label: "Java",
      languageIds: ["java"],
      extensions: ["java"],
      command: "jdtls",
      args: [],
      installHint: "Install Eclipse JDT LS and expose `jdtls` on PATH",
    },
  },
  {
    name: "Ruby (ruby-lsp)",
    server: {
      id: "ruby",
      label: "Ruby",
      languageIds: ["ruby"],
      extensions: ["rb"],
      command: "ruby-lsp",
      args: [],
      installHint: "gem install ruby-lsp",
    },
  },
  {
    name: "Bash (bash-language-server)",
    server: {
      id: "bash",
      label: "Bash",
      languageIds: ["shellscript"],
      extensions: ["sh", "bash"],
      command: "bash-language-server",
      args: ["start"],
      installHint: "npm install -g bash-language-server",
    },
  },
  {
    name: "YAML (yaml-language-server)",
    server: {
      id: "yaml",
      label: "YAML",
      languageIds: ["yaml"],
      extensions: ["yaml", "yml"],
      command: "yaml-language-server",
      args: ["--stdio"],
      installHint: "npm install -g yaml-language-server",
    },
  },
  {
    name: "Lua (lua-language-server)",
    server: {
      id: "lua",
      label: "Lua",
      languageIds: ["lua"],
      extensions: ["lua"],
      command: "lua-language-server",
      args: [],
      installHint: "Install lua-language-server via your package manager",
    },
  },
  {
    name: "Zig (zls)",
    server: {
      id: "zig",
      label: "Zig",
      languageIds: ["zig"],
      extensions: ["zig"],
      command: "zls",
      args: [],
      installHint: "Install zls (https://github.com/zigtools/zls)",
    },
  },
];

function splitList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

interface FormState {
  label: string;
  id: string;
  command: string;
  args: string;
  languageIds: string;
  extensions: string;
  installHint: string;
}

const EMPTY_FORM: FormState = {
  label: "",
  id: "",
  command: "",
  args: "",
  languageIds: "",
  extensions: "",
  installHint: "",
};

function formFromServer(server: CustomLspServer): FormState {
  return {
    label: server.label,
    id: server.id,
    command: server.command,
    args: server.args.join(" "),
    languageIds: server.languageIds.join(" "),
    extensions: server.extensions.join(" "),
    installHint: server.installHint ?? "",
  };
}

export function AddCustomLspServerDialog({ open, onOpenChange, editing, onSaved }: Props) {
  const { LL } = useI18nContext();
  const copy = LL.editor.lsp.dialog;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const upsert = useLspCustomServersStore((s) => s.upsert);

  useEffect(() => {
    if (!open) return;
    setError(undefined);
    setSubmitting(false);
    setForm(editing ? formFromServer(editing) : EMPTY_FORM);
  }, [open, editing]);

  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const onPreset = (name: string) => {
    const preset = PRESETS.find((p) => p.name === name);
    if (preset) setForm(formFromServer(preset.server));
  };

  const canSubmit =
    form.label.trim() &&
    form.id.trim() &&
    form.command.trim() &&
    form.languageIds.trim() &&
    form.extensions.trim();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    const client = useSessionsStore.getState().client;
    if (!client) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await upsert(client, {
        id: form.id.trim(),
        label: form.label.trim(),
        command: form.command.trim(),
        args: splitList(form.args),
        languageIds: splitList(form.languageIds),
        extensions: splitList(form.extensions),
        installHint: form.installHint.trim() || undefined,
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(humanizeError(err, copy.saveFailed()));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal"
          style={{ width: "min(560px, 92vw)", maxHeight: "min(640px, 90vh)", overflowY: "auto" }}
        >
          <div className="pid-modal-header">
            <RadixDialog.Title className="pid-modal-title">
              {editing ? copy.editTitle({ label: editing.label }) : copy.addTitle()}
            </RadixDialog.Title>
            <RadixDialog.Description className="pid-modal-description">
              {copy.description()}
            </RadixDialog.Description>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            {!editing && (
              <div className="pid-form-field">
                <label className="pid-form-label" htmlFor="lsp-preset">
                  {copy.presetLabel()}
                </label>
                <select
                  id="lsp-preset"
                  className="pid-form-select"
                  defaultValue=""
                  onChange={(e) => onPreset(e.target.value)}
                >
                  <option value="">{copy.presetBlank()}</option>
                  {PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-label">
                {copy.fieldLabel()}
              </label>
              <input
                id="lsp-label"
                className="pid-form-input"
                value={form.label}
                onChange={(e) => patch({ label: e.target.value })}
                // i18n-exempt: worked example, a language name
                placeholder="Elixir"
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-id">
                {copy.fieldId()}
              </label>
              <input
                id="lsp-id"
                className="pid-form-input"
                value={form.id}
                onChange={(e) => patch({ id: e.target.value })}
                // i18n-exempt: worked example, a server id
                placeholder="elixir"
                disabled={Boolean(editing)}
                spellCheck={false}
              />
              <span className="pid-form-hint">{copy.fieldIdHint()}</span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-command">
                {copy.fieldCommand()}
              </label>
              <input
                id="lsp-command"
                className="pid-form-input"
                value={form.command}
                onChange={(e) => patch({ command: e.target.value })}
                // i18n-exempt: worked example, an executable name
                placeholder="elixir-ls"
                spellCheck={false}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-args">
                {copy.fieldArgs()}
              </label>
              <input
                id="lsp-args"
                className="pid-form-input"
                value={form.args}
                onChange={(e) => patch({ args: e.target.value })}
                // i18n-exempt: worked example, a command-line flag
                placeholder="--stdio"
                spellCheck={false}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-langids">
                {copy.fieldLanguageIds()}
              </label>
              <input
                id="lsp-langids"
                className="pid-form-input"
                value={form.languageIds}
                onChange={(e) => patch({ languageIds: e.target.value })}
                // i18n-exempt: worked example, LSP languageIds
                placeholder="elixir eex phoenix-heex"
                spellCheck={false}
              />
              <span className="pid-form-hint">
                {rich(copy.fieldLanguageIdsHint({ code: slot("code") }), {
                  // i18n-exempt: the LSP field name, spelled as the spec spells it
                  code: <code>languageId</code>,
                })}
              </span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-exts">
                {copy.fieldExtensions()}
              </label>
              <input
                id="lsp-exts"
                className="pid-form-input"
                value={form.extensions}
                onChange={(e) => patch({ extensions: e.target.value })}
                // i18n-exempt: worked example, file extensions
                placeholder="ex exs heex:phoenix-heex"
                spellCheck={false}
              />
              <span className="pid-form-hint">
                {rich(
                  copy.fieldExtensionsHint({ bare: slot("bare"), qualified: slot("qualified") }),
                  // i18n-exempt: file extensions, typed verbatim by the user
                  { bare: <code>ex</code>, qualified: <code>heex:phoenix-heex</code> },
                )}
              </span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-hint">
                {copy.fieldInstallHint()}
              </label>
              <input
                id="lsp-hint"
                className="pid-form-input"
                value={form.installHint}
                onChange={(e) => patch({ installHint: e.target.value })}
                // i18n-exempt: worked example, a shell command
                placeholder="cs install metals"
              />
              <span className="pid-form-hint">{copy.fieldInstallHintHint()}</span>
            </div>
            {error && (
              <div className="pid-form-hint" style={{ color: "var(--del)" }}>
                {error}
              </div>
            )}
            <div className="pid-form-row">
              <PidButton variant="ghost" onClick={() => onOpenChange(false)} longLabel>
                {LL.common.cancel()}
              </PidButton>
              <PidButton
                variant="primary"
                type="submit"
                disabled={!canSubmit || submitting}
                longLabel
              >
                {submitting ? copy.submitting() : editing ? copy.saveChanges() : copy.addServer()}
              </PidButton>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
