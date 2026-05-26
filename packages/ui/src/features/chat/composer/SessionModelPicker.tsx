import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "../../../components/icons/index.js";
import { ProviderIcon } from "../../models/icons/index.js";
import { useProvidersStore } from "../../models/useProvidersStore.js";
import { useSessionsStore } from "../../sessions/useSessionsStore.js";

interface ProviderGroup {
  id: string;
  name: string;
  iconKey: string;
  isDefault: boolean;
  models: ModelInfo[];
}

type ListRow =
  | { kind: "header"; groupId: string; groupName: string; isDefault: boolean }
  | {
      kind: "model";
      key: string;
      providerId: string;
      modelId: string;
      iconKey: string;
      label: string;
      ctx: string | undefined;
      isActive: boolean;
    };

const HEADER_ROW_PX = 28;
const MODEL_ROW_PX = 30;

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

interface SessionModelPickerProps {
  sessionId: string;
}

export function SessionModelPicker({ sessionId }: SessionModelPickerProps) {
  const session = useSessionsStore((s) => s.sessions.find((x) => x.id === sessionId));
  const providers = useProvidersStore((s) => s.providers);
  const modelsByProvider = useProvidersStore((s) => s.modelsByProvider);
  const sessionSelection = useProvidersStore((s) => s.sessionSelection[sessionId]);
  const defaultModel = useProvidersStore((s) => s.defaultModel);
  const refreshModels = useProvidersStore((s) => s.refreshModels);
  const setSessionModel = useProvidersStore((s) => s.setSessionModel);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  useEffect(() => {
    for (const provider of providers) {
      if (provider.authState !== "authenticated") continue;
      if (modelsByProvider[provider.id]) continue;
      void refreshModels(provider.id);
    }
  }, [providers, modelsByProvider, refreshModels]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  const activeRef = sessionSelection?.modelRef ?? session?.modelRef ?? defaultModel;
  const activeKey = activeRef ? refKey(activeRef) : "";

  const groups = useMemo<ProviderGroup[]>(() => {
    return providers
      .map<ProviderGroup>((p) => ({
        id: p.id,
        name: p.name,
        iconKey: p.iconKey,
        isDefault: defaultModel?.providerId === p.id,
        models: modelsByProvider[p.id] ?? [],
      }))
      .filter((g) => g.models.length > 0);
  }, [providers, modelsByProvider, defaultModel]);

  const activeIconKey = useMemo(() => {
    if (!activeRef) return undefined;
    return providers.find((p) => p.id === activeRef.providerId)?.iconKey;
  }, [activeRef, providers]);

  const activeLabel = useMemo(() => {
    if (!activeRef) return "model";
    for (const group of groups) {
      if (group.id !== activeRef.providerId) continue;
      const m = group.models.find((mm) => mm.id === activeRef.modelId);
      if (m) return m.label;
    }
    return activeRef.modelId;
  }, [activeRef, groups]);

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

  const rows = useMemo<ListRow[]>(() => {
    const out: ListRow[] = [];
    for (const g of filteredGroups) {
      out.push({ kind: "header", groupId: g.id, groupName: g.name, isDefault: g.isDefault });
      for (const m of g.models) {
        const key = `${g.id}/${m.id}`;
        out.push({
          kind: "model",
          key,
          providerId: g.id,
          modelId: m.id,
          iconKey: g.iconKey,
          label: m.label,
          ctx: formatContextWindow(m.contextWindow),
          isActive: key === activeKey,
        });
      }
    }
    return out;
  }, [filteredGroups, activeKey]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParent,
    estimateSize: (i) => (rows[i]?.kind === "header" ? HEADER_ROW_PX : MODEL_ROW_PX),
    overscan: 6,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const keyToFlatIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === "model") m.set(r.key, i);
    });
    return m;
  }, [rows]);

  useEffect(() => {
    if (!open) return;
    const activeIdx = activeKey ? keyToFlatIndex.get(activeKey) : undefined;
    if (activeIdx !== undefined) {
      const activeRow = rows[activeIdx];
      if (activeRow?.kind === "model") {
        setHighlightedKey(activeRow.key);
        requestAnimationFrame(() => rowVirtualizer.scrollToIndex(activeIdx, { align: "center" }));
        return;
      }
    }
    const firstModelIdx = rows.findIndex((r) => r.kind === "model");
    if (firstModelIdx >= 0) {
      const firstRow = rows[firstModelIdx];
      if (firstRow?.kind === "model") setHighlightedKey(firstRow.key);
    } else {
      setHighlightedKey(null);
    }
  }, [open, rows, activeKey, keyToFlatIndex, rowVirtualizer]);

  const onPick = (providerId: string, modelId: string) => {
    void setSessionModel(sessionId, { providerId, modelId });
    setOpen(false);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const modelKeys: string[] = [];
      for (const r of rows) if (r.kind === "model") modelKeys.push(r.key);
      if (modelKeys.length === 0) return;
      const curIdx = highlightedKey ? modelKeys.indexOf(highlightedKey) : -1;
      const nextIdx =
        e.key === "ArrowDown"
          ? curIdx < 0
            ? 0
            : Math.min(curIdx + 1, modelKeys.length - 1)
          : curIdx <= 0
            ? 0
            : curIdx - 1;
      const nextKey = modelKeys[nextIdx];
      if (!nextKey) return;
      setHighlightedKey(nextKey);
      const flatIdx = keyToFlatIndex.get(nextKey);
      if (flatIdx !== undefined) rowVirtualizer.scrollToIndex(flatIdx, { align: "auto" });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!highlightedKey) return;
      const flatIdx = keyToFlatIndex.get(highlightedKey);
      if (flatIdx === undefined) return;
      const row = rows[flatIdx];
      if (row?.kind === "model") onPick(row.providerId, row.modelId);
      return;
    }
    e.stopPropagation();
  };

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <RadixDropdown.Root open={open} onOpenChange={setOpen}>
      <RadixDropdown.Trigger asChild disabled={groups.length === 0}>
        <button type="button" className="pid-picker-trigger" aria-label="Select model">
          {activeIconKey ? (
            <ProviderIcon iconKey={activeIconKey} size={14} className="pid-picker-trigger-icon" />
          ) : (
            <span className="pid-picker-trigger-pi" aria-hidden>
              π
            </span>
          )}
          <span className="pid-picker-trigger-label">{activeLabel}</span>
          <ChevronDown size={10} className="pid-picker-trigger-chev" />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="end"
          side="top"
          sideOffset={6}
          className="pid-picker-menu pid-model-menu"
          {...({ onOpenAutoFocus: (e: Event) => e.preventDefault() } as Record<string, unknown>)}
        >
          <div className="pid-model-menu-search">
            <Search size={14} aria-hidden className="pid-model-menu-search-icon" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search models…"
              className="pid-model-menu-search-input"
              onKeyDown={onInputKeyDown}
            />
          </div>
          <div ref={setScrollParent} className="pid-model-menu-list">
            {rows.length === 0 ? (
              <div className="pid-model-menu-empty">No models match</div>
            ) : (
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualRows.map((vi) => {
                  const row = rows[vi.index];
                  if (!row) return null;
                  return (
                    <div
                      key={vi.key}
                      data-index={vi.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${vi.start}px)`,
                      }}
                    >
                      {row.kind === "header" ? (
                        <div className="pid-model-menu-section-head">
                          <span>{row.groupName}</span>
                          {row.isDefault && (
                            <span className="pid-model-menu-section-default">default</span>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="pid-model-menu-item"
                          data-has-icon
                          data-active={row.isActive || undefined}
                          data-highlighted={row.key === highlightedKey || undefined}
                          onClick={() => onPick(row.providerId, row.modelId)}
                          onMouseEnter={() => setHighlightedKey(row.key)}
                        >
                          <span className="pid-model-menu-item-check" aria-hidden>
                            {row.isActive ? <Check size={12} /> : null}
                          </span>
                          <span className="pid-model-menu-item-icon" aria-hidden>
                            <ProviderIcon iconKey={row.iconKey} size={14} />
                          </span>
                          <span className="pid-model-menu-item-label">{row.label}</span>
                          {row.ctx && <span className="pid-model-menu-item-sub">{row.ctx}</span>}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
