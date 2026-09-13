import type { CustomProviderApi } from "@pi-deck/core/providers/types.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { rich, slot } from "../../i18n/rich.js";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useProvidersStore } from "./useProvidersStore.js";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onAdded?: (providerId: string) => void;
}

// i18n-exempt: these name OpenAI's own APIs; the parenthetical lists the servers that speak them
const API_OPTIONS: { id: CustomProviderApi; label: string }[] = [
  { id: "openai-completions", label: "OpenAI Chat Completions (LM Studio / Ollama / vLLM)" },
  { id: "openai-responses", label: "OpenAI Responses API" },
];

export function AddCustomProviderDialog({ open, onOpenChange, onAdded }: Props) {
  const { LL } = useI18nContext();
  const copy = LL.models.addCustom;
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:1234/v1");
  const [api, setApi] = useState<CustomProviderApi>("openai-completions");
  const [apiKey, setApiKey] = useState("");
  const [defaultModelId, setDefaultModelId] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const addCustomProvider = useProvidersStore((s) => s.addCustomProvider);
  const refreshModels = useProvidersStore((s) => s.refreshModels);

  useEffect(() => {
    if (!open) {
      setName("");
      setBaseUrl("http://localhost:1234/v1");
      setApi("openai-completions");
      setApiKey("");
      setDefaultModelId("");
      setError(undefined);
      setSubmitting(false);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      const provider = await addCustomProvider({
        name: name.trim(),
        baseUrl: baseUrl.trim(),
        api,
        apiKey: apiKey.trim() || undefined,
        defaultModelId: defaultModelId.trim() || undefined,
      });
      // Kick off a catalogue fetch so the picker has data on open.
      void refreshModels(provider.id);
      onAdded?.(provider.id);
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
          style={{ width: "min(520px, 92vw)", maxHeight: "auto" }}
        >
          <div className="pid-modal-header">
            <RadixDialog.Title className="pid-modal-title">{copy.title()}</RadixDialog.Title>
            <RadixDialog.Description className="pid-modal-description">
              {copy.description()}
            </RadixDialog.Description>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="cp-name">
                {copy.name()}
              </label>
              <input
                id="cp-name"
                className="pid-form-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                // i18n-exempt: worked example, a product name
                placeholder="LM Studio"
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="cp-base">
                {copy.baseUrl()}
              </label>
              <input
                id="cp-base"
                className="pid-form-input"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:1234/v1"
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="cp-api">
                {copy.apiKind()}
              </label>
              <select
                id="cp-api"
                className="pid-form-select"
                value={api}
                onChange={(e) => setApi(e.target.value as CustomProviderApi)}
              >
                {API_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="cp-key">
                {copy.apiKey()}
              </label>
              <input
                id="cp-key"
                type="password"
                className="pid-form-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={copy.apiKeyPlaceholder()}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="cp-model">
                {copy.defaultModel()}
              </label>
              <input
                id="cp-model"
                className="pid-form-input"
                value={defaultModelId}
                onChange={(e) => setDefaultModelId(e.target.value)}
                // i18n-exempt: worked example, a model id
                placeholder="qwen2.5-coder:7b"
              />
              <span className="pid-form-hint">
                {rich(copy.defaultModelHint({ path: slot("path") }), {
                  // i18n-exempt: the endpoint path the provider must serve
                  path: <code>/v1/models</code>,
                })}
              </span>
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
                disabled={!name.trim() || !baseUrl.trim() || submitting}
                longLabel
              >
                {submitting ? copy.submitting() : copy.submit()}
              </PidButton>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
