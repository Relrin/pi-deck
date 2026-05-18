import type { SessionModelRef } from "@pi-deck/core/domain/session.js";
import type { ModelInfo } from "@pi-deck/core/providers/types.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useVirtualizer } from "@tanstack/react-virtual";
import Fuse from "fuse.js";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
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

// Flattened representation for the virtualizer — alternates between provider headers and
// model rows. Building one flat list (instead of one virtualizer per group) keeps the
// scroll math simple and lets one keyboard-nav cursor walk across all providers.
type ListRow =
  | {
      kind: "header";
      groupId: string;
      groupName: string;
      isDefault: boolean;
    }
  | {
      kind: "model";
      key: string;
      providerId: string;
      modelId: string;
      label: string;
      ctx: string | undefined;
      isActive: boolean;
    };

// Row-height estimates feed virtualizer math before items mount; the wrapper uses
// `measureElement` to correct itself after first paint, so these only need to be close.
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
  // Callback-ref-as-state: forces a re-render when the Radix portal mounts the
  // scroll element so the virtualizer below picks it up. A plain useRef leaves
  // the virtualizer stuck with a null scroll parent on first open — it returns
  // no virtual items even though getTotalSize() is non-zero, which renders the
  // list area as an empty body with a bare scrollbar.
  const [scrollParent, setScrollParent] = useState<HTMLDivElement | null>(null);

  // Keyboard-nav cursor inside the filtered list. We manage it ourselves because the
  // model rows are plain <button>s (not RadixDropdown.Item) — see comment near the
  // virtualizer render block for why.
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

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

  // Flatten groups into a single virtualizable list (header row + model rows per group).
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

  // Build a quick index from `model.key` → flat-row index so keyboard nav and the
  // on-open auto-scroll can jump straight to a row without a second linear search.
  const keyToFlatIndex = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.kind === "model") m.set(r.key, i);
    });
    return m;
  }, [rows]);

  // On open: if there's an active model in the current filter, highlight + scroll to it;
  // otherwise highlight the first model row so Enter still selects something sensible.
  // This effect also fires when `rows` change (typing in the search), naturally moving
  // the highlight to the first match.
  useEffect(() => {
    if (!open) return;
    const activeIdx = activeKey ? keyToFlatIndex.get(activeKey) : undefined;
    if (activeIdx !== undefined) {
      const activeRow = rows[activeIdx];
      if (activeRow?.kind === "model") {
        setHighlightedKey(activeRow.key);
        // Defer until after Radix mounts the portal + the scroll element has a real size.
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
    setPendingModel({ providerId, modelId });
    setOpen(false);
  };

  // Search input owns focus + keyboard nav. Arrow keys move our highlightedKey cursor
  // and keep it scrolled into view; Enter activates the highlighted row.
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") return; // let Radix close the popover
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // Walk only model rows — Up/Down should skip headers.
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
      // `provider.id/model.id` may legitimately contain '/' inside model.id (OpenRouter
      // does this — e.g. "anthropic/claude-3.5"), so we look up the row instead of split.
      const flatIdx = keyToFlatIndex.get(highlightedKey);
      if (flatIdx === undefined) return;
      const row = rows[flatIdx];
      if (row?.kind === "model") onPick(row.providerId, row.modelId);
      return;
    }
    // Block Radix DropdownMenu's typeahead from stealing keystrokes when focus is here.
    e.stopPropagation();
  };

  const virtualRows = rowVirtualizer.getVirtualItems();

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
              onKeyDown={onInputKeyDown}
            />
          </div>
          {/* Virtualized rows. Model rows are plain <button>s instead of RadixDropdown.Item
              because mounting 300+ Radix items registers each one with the parent Menu's
              RovingFocusGroup on open — that registration is the lag the user reported. With
              virtualization, items also mount/unmount during scroll, which would churn that
              same focus context. Plain buttons sidestep both: we own focus management via
              `highlightedKey` + arrow-key handling on the search input above. */}
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
                          data-active={row.isActive || undefined}
                          data-highlighted={row.key === highlightedKey || undefined}
                          onClick={() => onPick(row.providerId, row.modelId)}
                          onMouseEnter={() => setHighlightedKey(row.key)}
                        >
                          <span className="pid-model-menu-item-check" aria-hidden>
                            {row.isActive ? <Check size={12} /> : null}
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
