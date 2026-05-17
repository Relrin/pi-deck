import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { type FormEvent, useEffect, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
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
      setError(humanizeError(err, "Failed to save API key"));
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
              Authenticate {provider?.name ?? "provider"}
            </RadixDialog.Title>
          </div>
          <form className="pid-form" onSubmit={onSubmit}>
            <div className="pid-form-field">
              <label className="pid-form-label" htmlFor="api-key-input">
                API key
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
                Stored in pi's {`~/.pi/agent/auth.json`} (0600 perms). Never logged or sent back to
                the renderer.
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
                  title="OAuth landing in a future plan"
                >
                  Use {provider.name} OAuth (coming soon)
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
                Cancel
              </PidButton>
              <PidButton
                variant="primary"
                type="submit"
                disabled={!secret.trim() || submitting}
                longLabel
              >
                {submitting ? "Saving…" : "Save & test"}
              </PidButton>
            </div>
          </form>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
