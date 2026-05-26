import type { ThemeListing, ThemeSpec } from "@pi-deck/core";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { PidChip } from "../../components/chip/PidChip";
import { Check } from "../../components/icons/index.js";
import type { ProtocolClient } from "../../lib/transport/protocol-client";

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
    .then((spec) => {
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

export interface ThemePreviewCardProps {
  listing: ThemeListing;
  client: ProtocolClient | undefined;
  active: boolean;
  onSelect: (name: string) => void;
}

export function ThemePreviewCard({ listing, client, active, onSelect }: ThemePreviewCardProps) {
  const [spec, setSpec] = useState<ThemeSpec | undefined>(() => specCache.get(listing.name));

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

  const sourceLabel =
    listing.source === "user"
      ? "user"
      : listing.source === "bundled"
        ? "bundled"
        : (listing.source ?? "");

  return (
    <button
      type="button"
      className="pid-theme-card"
      data-active={active || undefined}
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
        {sourceLabel ? <PidChip variant="info">{sourceLabel}</PidChip> : null}
      </span>
    </button>
  );
}
