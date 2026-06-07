import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "../../components/icons/index.js";
import { PidPierreFileIcon } from "../../components/icons/PidPierreFileIcon.js";
import { cn } from "../../lib/cn.js";
import { useEditorStore } from "./useEditorStore.js";

/** Horizontal padding (`6px 8px`) + a little slack reserved inside the strip. */
const STRIP_PADDING = 18;
/** Gap between tabs (`.pid-editor-tabs` gap). */
const TAB_GAP = 4;
/** Reserved width for the overflow chevron button when there's overflow. */
const OVERFLOW_BTN = 54;

/** Filenames are stable after open, so reading them straight from the store (no subscription) is
 * fine — `order` changing is what drives a re-render. */
function fileNameOf(id: string): string {
  return useEditorStore.getState().tabs[id]?.fileName ?? id;
}

/**
 * The editor's open-file tab strip. Tabs keep their natural width; when they don't all fit, the
 * overflow collapses behind a chevron "stack" (dropdown) instead of a horizontal scrollbar. The
 * active tab is always kept visible. An off-screen ghost row measures natural tab widths so the
 * fit calculation never fights the rendered (clipped) row.
 */
export function PidEditorTabBar() {
  const order = useEditorStore((s) => s.order);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const setActive = useEditorStore((s) => s.setActive);

  const stripRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [visibleCount, setVisibleCount] = useState(order.length);

  // Measure natural widths from the ghost row and compute how many tabs fit. Re-runs on open/close
  // (order) and on any strip resize (center-pane drag, window resize).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `order` re-measures; widths come from the ghost row refs.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const measure = () => {
      const avail = strip.clientWidth - STRIP_PADDING;
      const widthOf = (id: string) => {
        const el = ghostRefs.current.get(id);
        return el ? el.offsetWidth + TAB_GAP : 0;
      };
      const total = order.reduce((sum, id) => sum + widthOf(id), 0);
      if (total <= avail) {
        setVisibleCount(order.length);
        return;
      }
      let used = OVERFLOW_BTN;
      let count = 0;
      for (const id of order) {
        used += widthOf(id);
        if (used > avail) break;
        count++;
      }
      setVisibleCount(Math.max(count, activeTabId ? 1 : 0));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(strip);
    return () => ro.disconnect();
  }, [order]);

  const fits = visibleCount >= order.length;
  const visibleIds = fits ? order : computeVisible(order, activeTabId, visibleCount);
  const hiddenIds = fits ? [] : order.filter((id) => !visibleIds.includes(id));

  return (
    <div className="pid-editor-tabs" role="tablist" aria-label="Open files" ref={stripRef}>
      {/* Off-screen measurement row: identical markup at natural width. */}
      <div className="pid-editor-tabs-ghost" aria-hidden="true">
        {order.map((id) => (
          <div
            key={id}
            className="pid-editor-tab"
            ref={(el) => {
              if (el) ghostRefs.current.set(id, el);
              else ghostRefs.current.delete(id);
            }}
          >
            <PidPierreFileIcon path={fileNameOf(id)} size={14} className="pid-editor-tab-icon" />
            <span className="name">{fileNameOf(id)}</span>
            <span className="close">✕</span>
          </div>
        ))}
      </div>

      {visibleIds.map((id) => (
        <PidEditorTab key={id} id={id} />
      ))}

      {hiddenIds.length > 0 ? (
        <RadixDropdown.Root>
          <RadixDropdown.Trigger asChild>
            <button
              type="button"
              className="pid-editor-tab-overflow"
              aria-label={`${hiddenIds.length} more open files`}
              title={`${hiddenIds.length} more open files`}
            >
              <ChevronDown size={14} aria-hidden="true" />
              <span>{hiddenIds.length}</span>
            </button>
          </RadixDropdown.Trigger>
          <RadixDropdown.Portal>
            <RadixDropdown.Content align="end" sideOffset={6} className="pid-editor-overflow-menu">
              {hiddenIds.map((id) => (
                <RadixDropdown.Item
                  key={id}
                  className="pid-editor-overflow-row"
                  onSelect={() => setActive(id)}
                >
                  <PidPierreFileIcon
                    path={fileNameOf(id)}
                    size={14}
                    className="pid-editor-tab-icon"
                  />
                  <span className="name">{fileNameOf(id)}</span>
                </RadixDropdown.Item>
              ))}
            </RadixDropdown.Content>
          </RadixDropdown.Portal>
        </RadixDropdown.Root>
      ) : null}
    </div>
  );
}

/** Keep `order`, but if the active tab fell outside the fitting window, pull it into the last
 * visible slot so it's never hidden behind the overflow menu. */
function computeVisible(order: string[], active: string | null, count: number): string[] {
  const visible = order.slice(0, count);
  if (active && count > 0 && !visible.includes(active)) {
    visible[count - 1] = active;
  }
  return visible;
}

/** A single tab row. Subscribes only to its own name + dirty + active so cursor churn on the
 * active tab doesn't re-render the whole strip. */
function PidEditorTab({ id }: { id: string }) {
  const fileName = useEditorStore((s) => s.tabs[id]?.fileName ?? "");
  const dirty = useEditorStore((s) => s.tabs[id]?.dirty ?? false);
  const active = useEditorStore((s) => s.activeTabId === id);
  const setActive = useEditorStore((s) => s.setActive);
  const closeTab = useEditorStore((s) => s.closeTab);

  return (
    <div
      className={cn("pid-editor-tab", active && "active")}
      role="tab"
      aria-selected={active}
      tabIndex={0}
      onClick={() => setActive(id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setActive(id);
        }
      }}
    >
      <PidPierreFileIcon path={fileName} size={14} className="pid-editor-tab-icon" />
      <span className="name">{fileName}</span>
      {dirty ? <span className="dot" role="img" aria-label="Unsaved changes" /> : null}
      <button
        type="button"
        className="close"
        aria-label={`Close ${fileName}`}
        tabIndex={-1}
        onClick={(e) => {
          e.stopPropagation();
          closeTab(id);
        }}
      >
        ✕
      </button>
    </div>
  );
}
