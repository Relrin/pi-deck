import { useCallback } from "react";
import { BUILT_IN_TOOLS } from "./toolCatalog.js";

interface ToolsListProps {
  /** Tool ids that should appear with their switch OFF. */
  excludedTools: string[];
  /** Called with the next exclusion list whenever the user flips a switch. */
  onChange: (nextExcludedTools: string[]) => void;
}

/**
 * The rows-of-toggles widget shared by the Settings → Tools section and the per-session
 * tools popover in the composer. Layout matches the mockup: tool name in mono, one-line
 * description in `--ink-2`, switch right-aligned. No icon column.
 *
 * The component is purely controlled — the parent owns the source of truth and decides
 * whether the toggle persists to local default or fires an RPC. Keeps `useToolsStore`
 * out of this file so the same list reuses cleanly across both surfaces.
 */
export function ToolsList({ excludedTools, onChange }: ToolsListProps) {
  const excluded = new Set(excludedTools);

  const onToggle = useCallback(
    (id: string) => {
      const next = new Set(excluded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onChange([...next].sort());
    },
    [excluded, onChange],
  );

  return (
    <ul className="pid-tools-list">
      {BUILT_IN_TOOLS.map((tool) => {
        const on = !excluded.has(tool.id);
        return (
          <li key={tool.id} className="pid-tools-list-row">
            <div className="pid-tools-list-body">
              <span className="pid-tools-list-name">{tool.label}</span>
              <span className="pid-tools-list-desc">{tool.description}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={`${tool.label}: ${on ? "enabled" : "disabled"}`}
              className="pid-toggle-switch"
              data-on={on || undefined}
              onClick={() => onToggle(tool.id)}
            >
              <span className="pid-toggle-switch-thumb" aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
