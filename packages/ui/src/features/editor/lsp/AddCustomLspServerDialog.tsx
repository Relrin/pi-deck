import type { CustomLspServer } from "@pi-deck/core/protocol/lsp.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../../components/buttons/PidButton";
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
      setError(humanizeError(err, "Failed to save server"));
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
              {editing ? `Edit ${editing.label}` : "Add language server"}
            </RadixDialog.Title>
            <RadixDialog.Description className="pid-modal-description">
              The command is resolved on the project environment's PATH, exactly like the built-in
              servers — nothing is downloaded.
            </RadixDialog.Description>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            {!editing && (
              <div className="pid-form-field">
                <label className="pid-form-label" htmlFor="lsp-preset">
                  Start from a preset (optional)
                </label>
                <select
                  id="lsp-preset"
                  className="pid-form-select"
                  defaultValue=""
                  onChange={(e) => onPreset(e.target.value)}
                >
                  <option value="">Blank</option>
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
                Label
              </label>
              <input
                id="lsp-label"
                className="pid-form-input"
                value={form.label}
                onChange={(e) => patch({ label: e.target.value })}
                placeholder="Elixir"
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-id">
                Id
              </label>
              <input
                id="lsp-id"
                className="pid-form-input"
                value={form.id}
                onChange={(e) => patch({ id: e.target.value })}
                placeholder="elixir"
                disabled={Boolean(editing)}
                spellCheck={false}
              />
              <span className="pid-form-hint">
                Lowercase letters, digits, hyphens. Can't collide with a built-in server id.
              </span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-command">
                Command
              </label>
              <input
                id="lsp-command"
                className="pid-form-input"
                value={form.command}
                onChange={(e) => patch({ command: e.target.value })}
                placeholder="elixir-ls"
                spellCheck={false}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-args">
                Arguments (optional)
              </label>
              <input
                id="lsp-args"
                className="pid-form-input"
                value={form.args}
                onChange={(e) => patch({ args: e.target.value })}
                placeholder="--stdio"
                spellCheck={false}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-langids">
                Language ids
              </label>
              <input
                id="lsp-langids"
                className="pid-form-input"
                value={form.languageIds}
                onChange={(e) => patch({ languageIds: e.target.value })}
                placeholder="elixir eex phoenix-heex"
                spellCheck={false}
              />
              <span className="pid-form-hint">
                LSP <code>languageId</code>s the server understands, space-separated.
              </span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-exts">
                File extensions
              </label>
              <input
                id="lsp-exts"
                className="pid-form-input"
                value={form.extensions}
                onChange={(e) => patch({ extensions: e.target.value })}
                placeholder="ex exs heex:phoenix-heex"
                spellCheck={false}
              />
              <span className="pid-form-hint">
                No dots. A bare <code>ex</code> maps to the first language id;{" "}
                <code>heex:phoenix-heex</code> picks another.
              </span>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="lsp-hint">
                Install hint (optional)
              </label>
              <input
                id="lsp-hint"
                className="pid-form-input"
                value={form.installHint}
                onChange={(e) => patch({ installHint: e.target.value })}
                placeholder="cs install metals"
              />
              <span className="pid-form-hint">Shown when the command isn't found on PATH.</span>
            </div>
            {error && (
              <div className="pid-form-hint" style={{ color: "var(--del)" }}>
                {error}
              </div>
            )}
            <div className="pid-form-row">
              <PidButton variant="ghost" onClick={() => onOpenChange(false)} longLabel>
                Cancel
              </PidButton>
              <PidButton
                variant="primary"
                type="submit"
                disabled={!canSubmit || submitting}
                longLabel
              >
                {submitting ? "Saving…" : editing ? "Save changes" : "Add server"}
              </PidButton>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
