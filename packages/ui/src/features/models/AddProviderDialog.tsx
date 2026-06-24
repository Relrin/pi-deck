import type { ProviderSummary } from "@pi-deck/core/providers/types.js";
import * as RadixDialog from "@radix-ui/react-dialog";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PidButton } from "../../components/buttons/PidButton";
import { ProviderAvatar } from "./icons";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Built-in providers without a key yet — the ones a user can still add. */
  providers: ProviderSummary[];
  /** Called with the chosen provider; the parent opens the key-entry dialog. */
  onSelect: (provider: ProviderSummary) => void;
}

const THIN_CTL = {
  height: 28,
  paddingTop: 0,
  paddingBottom: 0,
  boxSizing: "border-box",
  lineHeight: 1,
} as const;

/**
 * Settings → Agents & Models → Add provider. A searchable picker over the built-in providers
 * that don't have a key yet. Picking one hands off to {@link AuthenticateProviderDialog} (via
 * the parent) so the user pastes a token — the same flow as "Replace key" on a configured row.
 */
export function AddProviderDialog({ open, onOpenChange, providers, onSelect }: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.envVar?.toLowerCase().includes(q) ?? false),
    );
  }, [providers, query]);

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal"
          style={{ width: "min(520px, 92vw)", maxHeight: "min(70vh, 560px)" }}
        >
          <div className="pid-modal-header">
            <div>
              <div className="pid-settings-section-kicker">providers · pi</div>
              <RadixDialog.Title className="pid-modal-title" style={{ fontStyle: "normal" }}>
                Add provider
              </RadixDialog.Title>
            </div>
            <RadixDialog.Description className="pid-modal-description">
              Choose a provider and add an API key. Its models appear in the picker once a key is
              saved.
            </RadixDialog.Description>
            <PidButton
              variant="ghost"
              style={THIN_CTL}
              icon={<X size={12} aria-hidden />}
              onClick={() => onOpenChange(false)}
            >
              esc
            </PidButton>
          </div>

          {/* Search bar */}
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--line)",
              background: "var(--bg-0)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                color: "var(--ink-3)",
              }}
            >
              <Search size={13} aria-hidden style={{ flexShrink: 0 }} />
              <input
                // biome-ignore lint/a11y/noAutofocus: searching is the point of the modal
                autoFocus
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 0,
                  outline: "none",
                  background: "transparent",
                  padding: 0,
                  margin: 0,
                  color: "var(--ink-0)",
                  fontFamily: "var(--font-ui)",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search providers — name or env var…"
                spellCheck={false}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)" }}>
                {filtered.length}
              </span>
            </div>
          </div>

          {/* Results */}
          <div className="pid-provider-pick-list">
            {providers.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "32px 16px" }}>
                Every built-in provider already has a key. Manage them on the previous screen.
              </div>
            ) : filtered.length === 0 ? (
              <div className="pid-list-empty" style={{ padding: "32px 16px" }}>
                No providers match{" "}
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-1)" }}>
                  “{query}”
                </span>
                .
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="pid-provider-pick-row"
                  onClick={() => onSelect(p)}
                >
                  <ProviderAvatar iconKey={p.iconKey} size={20} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pid-provider-pick-name">{p.name}</div>
                    {p.envVar && <div className="pid-provider-pick-env">{p.envVar}</div>}
                  </div>
                  <span className="pid-provider-pick-add">Add key</span>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--line)",
              background: "var(--bg-0)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--ink-3)",
              letterSpacing: "0.04em",
            }}
          >
            <span>{filtered.length} available</span>
            <span style={{ marginLeft: "auto", color: "var(--ink-2)" }}>
              keys saved to <span style={{ color: "var(--accent)" }}>~/.pi/agent/auth.json</span>
            </span>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
