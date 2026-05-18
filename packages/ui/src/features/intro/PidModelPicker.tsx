import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import Fuse from "fuse.js";
import { useEffect, useMemo, useRef, useState } from "react";
import { Glyph } from "../../components/glyph/index.js";
import { Check, Search } from "../../components/icons/index.js";
import { useProvidersStore } from "../models/useProvidersStore.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

interface ProviderGroup {
  id: string;
  name: string;
  isDefault: boolean;
  models: ModelInfo[];
}

function refKey(ref: SessionModelRef): string {
  return `${ref.providerId}/${ref.modelId}`;
}

function formatContextWindow(n: number | undefined): string | undefined {
  if (!n) return undefined;
  if (n >= 1_000_000) {
    const m = Math.round((n / 1_000_000) * 10) / 10;
    return `${m}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
}

export function PidModelPicker() {
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const defaultModel = useProvidersStore((s) => s.defaultModel);
  const refreshModels = useProvidersStore((s) => s.refreshModels);
  const pendingModelRef = useIntroComposerStore((s) => s.pendingModelRef);
  const setPendingModel = useIntroComposerStore((s) => s.setPendingModel);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    for (const provider of providers) {
      if (provider.authState !== "authenticated") continue;
      if (modelsByProvider[provider.id]) continue;
      void refreshModels(provider.id);
    }
  }, [providers, modelsByProvider, refreshModels]);

  // Reset search and refocus the input each time the popover opens.
  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const activeRef = pendingModelRef ?? defaultModel;
  const activeKey = activeRef ? refKey(activeRef) : "";

  // Group models by provider (in provider-list order), skipping any with no loaded models.
  const groups = useMemo<ProviderGroup[]>(() => {
    return providers
      .map<ProviderGroup>((p) => ({
        id: p.id,
        name: p.name,
        isDefault: defaultModel?.providerId === p.id,
        models: modelsByProvider[p.id] ?? [],
      }))
      .filter((g) => g.models.length > 0);
  }, [providers, modelsByProvider, defaultModel]);

  const activeLabel = useMemo(() => {
    if (!activeRef) return "model";
    for (const group of groups) {
      if (group.id !== activeRef.providerId) continue;
      const m = group.models.find((mm) => mm.id === activeRef.modelId);
      if (m) return m.label;
    }
    return activeRef.modelId;
  }, [activeRef, groups]);

  // Flatten once for Fuse; matches reference the original (group, model) tuple by key.
  const searchable = useMemo(
    () =>
      groups.flatMap((g) =>
        g.models.map((m) => ({
          key: `${g.id}/${m.id}`,
          providerName: g.name,
          modelLabel: m.label,
          modelId: m.id,
        })),
      ),
    [groups],
  );

  const fuse = useMemo(
    () =>
      new Fuse(searchable, {
        keys: ["modelLabel", "modelId", "providerName"],
        threshold: 0.4,
        ignoreLocation: true,
      }),
    [searchable],
  );

  const filteredGroups = useMemo<ProviderGroup[]>(() => {
    const q = query.trim();
    if (!q) return groups;
    const matched = new Set(fuse.search(q).map((r) => r.item.key));
    return groups
      .map((g) => ({ ...g, models: g.models.filter((m) => matched.has(`${g.id}/${m.id}`)) }))
      .filter((g) => g.models.length > 0);
  }, [groups, query, fuse]);

  const onPick = (providerId: string, modelId: string) => {
    setPendingModel({ providerId, modelId });
    setOpen(false);
  };

  return (
    <RadixDropdown.Root open={open} onOpenChange={setOpen}>
      <RadixDropdown.Trigger asChild disabled={groups.length === 0}>
        <button type="button" className="pid-picker-trigger" aria-label="Select model">
          <span className="pid-picker-trigger-pi" aria-hidden>
            π
          </span>
          <span className="pid-picker-trigger-label">{activeLabel}</span>
          <Glyph kind="chevron-down" size={10} className="pid-picker-trigger-chev" />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          sideOffset={6}
          className="pid-picker-menu pid-model-menu"
          // The search input lives inside the menu — let it own focus instead of the first item.
          // `onOpenAutoFocus` is forwarded by the underlying Radix Menu primitive but isn't
          // surfaced in the DropdownMenu wrapper's types as of @radix-ui/react-dropdown-menu 2.1.
          {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as Record<string, unknown>)}
        >
          <div className="pid-model-menu-search">
            <Search size={14} aria-hidden className="pid-model-menu-search-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search options…"
              className="pid-model-menu-search-input"
              // Stop Radix DropdownMenu's typeahead from stealing keystrokes when focus is here.
              onKeyDown={(e) => {
                if (e.key === "Escape") return; // let Radix close on Escape
                e.stopPropagation();
              }}
            />
          </div>
          <div className="pid-model-menu-list">
            {filteredGroups.length === 0 && (
              <div className="pid-model-menu-empty">No models match</div>
            )}
            {filteredGroups.map((group) => (
              <div key={group.id} className="pid-model-menu-section">
                <div className="pid-model-menu-section-head">
                  <span>{group.name}</span>
                  {group.isDefault && (
                    <span className="pid-model-menu-section-default">default</span>
                  )}
                </div>
                {group.models.map((m) => {
                  const k = `${group.id}/${m.id}`;
                  const isActive = k === activeKey;
                  const ctx = formatContextWindow(m.contextWindow);
                  return (
                    <RadixDropdown.Item
                      key={k}
                      className="pid-model-menu-item"
                      data-active={isActive || undefined}
                      onSelect={() => onPick(group.id, m.id)}
                    >
                      <span className="pid-model-menu-item-check" aria-hidden>
                        {isActive ? <Check size={12} /> : null}
                      </span>
                      <span className="pid-model-menu-item-label">{m.label}</span>
                      {ctx && <span className="pid-model-menu-item-sub">{ctx}</span>}
                    </RadixDropdown.Item>
                  );
                })}
              </div>
            ))}
          </div>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
