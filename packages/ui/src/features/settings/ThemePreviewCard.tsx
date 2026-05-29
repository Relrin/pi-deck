import type { ThemeListing, ThemeSpec } from "@pi-deck/core";
import type { CSSProperties, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { PidChip } from "../../components/chip/PidChip";
import { Check, Trash2 } from "../../components/icons/index.js";
import type { ProtocolClient } from "../../lib/transport/protocol-client";
import { useThemeStore } from "../../theme/useThemeStore";
import { useNotificationStore } from "../_status/useNotificationStore";

/** Per-process cache so flipping through the grid doesn't re-fetch on every render. */
const specCache = new Map<string, ThemeSpec>();
const inflight = new Map<string, Promise<ThemeSpec>>();

async function fetchSpec(client: ProtocolClient, name: string): Promise<ThemeSpec> {
  const cached = specCache.get(name);
  if (cached) return cached;
  const existing = inflight.get(name);
  if (existing) return existing;
  const promise = client.themes
    .get(name)
    .then(({ spec }) => {
      specCache.set(name, spec);
      inflight.delete(name);
      return spec;
    })
    .catch((err) => {
      inflight.delete(name);
      throw err;
    });
  inflight.set(name, promise);
  return promise;
}

/** Drop a cached spec so the next render refetches — used when a theme is deleted. */
function invalidateSpecCache(name: string): void {
  specCache.delete(name);
  inflight.delete(name);
}

export interface ThemePreviewCardProps {
  listing: ThemeListing;
  client: ProtocolClient | undefined;
  active: boolean;
  onSelect: (name: string) => void;
}

export function ThemePreviewCard({ listing, client, active, onSelect }: ThemePreviewCardProps) {
  const [spec, setSpec] = useState<ThemeSpec | undefined>(() => specCache.get(listing.name));
  const [deleting, setDeleting] = useState(false);
  const deleteTheme = useThemeStore((s) => s.deleteTheme);

  useEffect(() => {
    if (!client) return;
    if (specCache.has(listing.name)) {
      setSpec(specCache.get(listing.name));
      return;
    }
    let cancelled = false;
    fetchSpec(client, listing.name)
      .then((next) => {
        if (!cancelled) setSpec(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, listing.name]);

  const wrapperStyle: CSSProperties = spec
    ? {
        // Scope the theme tokens to this card so children read its colours
        // even when the theme isn't the globally active one.
        ["--bg-0" as string]: spec["bg-0"] ?? undefined,
        ["--bg-1" as string]: spec["bg-1"] ?? undefined,
        ["--bg-2" as string]: spec["bg-2"] ?? undefined,
        ["--accent" as string]: spec.accent ?? undefined,
        ["--ink-0" as string]: spec["ink-0"] ?? undefined,
      }
    : {};

  // Bundled themes ship with the app and are forkable but not deletable; user-sourced themes
  // come from disk and can be removed. The chip variant tracks the source so users can scan
  // the grid for things they've added themselves.
  const isUser = listing.source === "user";
  const chipLabel = isUser ? "User" : "Default";
  const chipVariant = isUser ? "accent" : "info";

  // Delete is one-click intentionally — the theme file lives in the user themes dir and can
  // be re-imported, and if it's the active theme the host falls back to `default-dark`. The
  // confirmation toast doubles as the only feedback the user needs.
  async function handleDeleteClick(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (!client || deleting) return;
    setDeleting(true);
    try {
      await deleteTheme(client, listing.name);
      invalidateSpecCache(listing.name);
      useNotificationStore.getState().success(`Deleted theme ${listing.name}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete theme";
      useNotificationStore.getState().error(message);
      setDeleting(false);
    }
    // No reset on success — the card unmounts once the `theme.changed` event drops this
    // listing from the store.
  }

  return (
    <div className="pid-theme-card-wrap">
      <button
        type="button"
        className="pid-theme-card"
        data-active={active || undefined}
        data-source={listing.source ?? undefined}
        onClick={() => onSelect(listing.name)}
        style={wrapperStyle}
        aria-label={`Apply theme ${listing.name}`}
      >
        {active ? (
          <span className="pid-theme-card-check" aria-hidden>
            <Check size={10} />
          </span>
        ) : null}
        <span className="pid-theme-swatch" aria-hidden>
          <span style={{ background: "var(--bg-0)" }} />
          <span style={{ background: "var(--bg-1)" }} />
          <span style={{ background: "var(--accent)" }} />
          <span style={{ background: "var(--ink-0)" }} />
        </span>
        <span className="pid-theme-card-meta">
          <span className="pid-theme-card-name">{listing.name}</span>
          <PidChip variant={chipVariant}>{chipLabel}</PidChip>
        </span>
      </button>
      {isUser ? (
        <button
          type="button"
          className="pid-theme-card-delete"
          onClick={handleDeleteClick}
          aria-label={`Delete theme ${listing.name}`}
          title={`Delete theme ${listing.name}`}
          disabled={!client || deleting}
        >
          <Trash2 size={12} />
        </button>
      ) : null}
    </div>
  );
}
