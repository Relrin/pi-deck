import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { rich, slot } from "../../i18n/rich.js";
import { humanizeError } from "../../lib/format/humanize-error.js";
import { useProvidersStore } from "./useProvidersStore.js";

interface Props {
  provider: ProviderSummary | undefined;
  open: boolean;
  onOpenChange: (next: boolean) => void;
}

/**
 * Pastable-API-key dialog. The secret is sent to the host via `provider.setApiKey` and is
 * never echoed back to the renderer — once submitted, this component clears the input.
 */
export function AuthenticateProviderDialog({ provider, open, onOpenChange }: Props) {
  const { LL } = useI18nContext();
  const copy = LL.models.authenticate;
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const setApiKey = useProvidersStore((s) => s.setApiKey);

  useEffect(() => {
    if (!open) {
      setSecret("");
      setError(undefined);
      setSubmitting(false);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!provider || !secret.trim()) return;
    setSubmitting(true);
    setError(undefined);
    try {
      await setApiKey(provider.authJsonKey, secret.trim());
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
          style={{ width: "min(420px, 92vw)", maxHeight: "auto" }}
        >
          <div className="pid-modal-header">
            <RadixDialog.Title className="pid-modal-title">
              {copy.title({ provider: provider?.name ?? copy.titleFallback() })}
            </RadixDialog.Title>
            <RadixDialog.Description className="pid-modal-description">
              {copy.description()}
            </RadixDialog.Description>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="api-key-input">
                {copy.apiKey()}
              </label>
              <input
                id="api-key-input"
                type="password"
                autoComplete="off"
                spellCheck={false}
                className="pid-form-input"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={provider?.envVar ?? "sk-…"}
              />
              <span className="pid-form-hint">
                {rich(copy.storageHint({ path: slot("path") }), {
                  // i18n-exempt: the auth file's path on disk
                  path: <>~/.pi/agent/auth.json</>,
                })}
              </span>
            </div>
            {provider?.oauthSupported && (
              <div className="pid-form-field">
                <button
                  type="button"
                  className="pid-btn"
                  data-variant="ghost"
                  data-long-label
                  disabled
                  title={copy.oauthTitle()}
                >
                  {copy.oauth({ provider: provider.name })}
                </button>
              </div>
            )}
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
                disabled={!secret.trim() || submitting}
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
