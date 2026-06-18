import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ToolCase } from "../../components/icons/index.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ToolsList } from "./ToolsList.js";
import { useToolsStore } from "./useToolsStore.js";

/**
 * Per-session tools popover, sits in the chat composer between the agent-mode picker
 * and the attachments button. Reads the active session's exclusion list (with a local
 * mirror for snappy renders) and writes via `session.setExcludedTools` — the host
 * respawns the worker when the value changes.
 *
 * Trigger is a wrench-style icon. When any tool is excluded for this session, the icon
 * tints to `--accent` so the user can see at a glance that the default is overridden.
 * Mirrors the `data-has-attachments` convention on the attachments picker.
 */
export function SessionToolsButton() {
  const activeSessionId = useSessionsStore((s) => s.activeSessionId);
  const summary = useSessionsStore((s) => s.sessions.find((entry) => entry.id === activeSessionId));
  const mirror = useToolsStore((s) => (activeSessionId ? s.bySession[activeSessionId] : undefined));
  const defaultExcluded = useToolsStore((s) => s.defaultExcludedTools);
  const setSessionExcludedTools = useToolsStore((s) => s.setSessionExcludedTools);

  const disabled = !activeSessionId;
  // Local mirror wins (optimistic), then server summary, then global default. Matches the
  // resolution `useToolsStore.getExcluded` uses elsewhere — kept inline here to skip the
  // extra subscription overhead in this hot composer slot.
  const excludedTools = mirror ?? summary?.excludedTools ?? defaultExcluded;
  const hasExclusions = excludedTools.length > 0;

  const onChange = (next: string[]) => {
    if (!activeSessionId) return;
    void setSessionExcludedTools(activeSessionId, next);
  };

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-picker-trigger pid-picker-trigger-icon-only"
          aria-label={
            hasExclusions ? `Session tools (${excludedTools.length} off)` : "Session tools"
          }
          title="Session tools"
          data-has-exclusions={hasExclusions || undefined}
          disabled={disabled}
        >
          <ToolCase size={14} aria-hidden />
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="top"
          sideOffset={6}
          className="pid-picker-menu pid-tools-menu"
        >
          <div className="pid-picker-menu-header">Session tools</div>
          <p className="pid-tools-menu-blurb">
            Override for this session only. Settings - Tools sets the default for new sessions.
          </p>
          <ToolsList excludedTools={excludedTools} onChange={onChange} />
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}
