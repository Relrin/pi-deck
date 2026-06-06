import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { ChevronDown, GitBranch, Plus, Settings, Terminal } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { useSettingsStore } from "../settings/useSettingsStore.js";
import { useDetectedShells } from "./useDetectedShells.js";
import { useTerminalSettingsStore } from "./useTerminalSettingsStore.js";

/** Pick a glyph for a shell row. lucide has no brand icons, so Git Bash gets the branch mark. */
function shellIcon(label: string): ReactNode {
  if (/git/i.test(label)) return <GitBranch size={14} aria-hidden />;
  return <Terminal size={14} aria-hidden />;
}

export interface NewTerminalButtonProps {
  /** Open a new terminal. Pass a shell path to launch that kind; omit for the default shell. */
  onNew: (shellPath?: string) => void;
  /** When true the control is inert (e.g. no project open, so there is nowhere to spawn). */
  disabled?: boolean;
}

/**
 * The tab strip's "new terminal" control: a `+` that opens the default shell plus an adjacent
 * caret that opens a flyout of every detected shell (Windows-Terminal style). Picking a shell
 * opens a new tab running it; the effective default is marked.
 */
export function NewTerminalButton({ onNew, disabled }: NewTerminalButtonProps) {
  const { shells, defaultPath } = useDetectedShells();
  const configuredShell = useTerminalSettingsStore((s) => s.shellPath);
  // What the bare `+` resolves to: the configured shell when set, else the host's default.
  const effectiveDefault = configuredShell ?? defaultPath;

  const openSettings = () => {
    const settings = useSettingsStore.getState();
    settings.setSection("terminal");
    settings.setOpen(true);
  };

  return (
    <div className="pid-terminal-tab-new-group">
      <Tooltip content="New terminal">
        <button
          type="button"
          className="pid-terminal-tab-new"
          aria-label="New terminal"
          disabled={disabled}
          onClick={() => onNew()}
        >
          <Plus size={13} aria-hidden />
        </button>
      </Tooltip>
      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button
            type="button"
            className="pid-terminal-tab-new-caret"
            aria-label="Choose terminal type"
            disabled={disabled}
          >
            <ChevronDown size={11} aria-hidden />
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content align="end" sideOffset={6} className="pid-context-menu">
            {shells.length === 0 ? (
              <RadixDropdown.Item disabled className="pid-context-menu-item">
                <span className="pid-context-menu-label">No shells detected</span>
              </RadixDropdown.Item>
            ) : (
              shells.map((shell) => (
                <RadixDropdown.Item
                  key={shell.path}
                  className="pid-context-menu-item"
                  onSelect={() => onNew(shell.path)}
                >
                  <span className="pid-context-menu-icon" aria-hidden>
                    {shellIcon(shell.label)}
                  </span>
                  <span className="pid-context-menu-label">{shell.label}</span>
                  {shell.path === effectiveDefault ? (
                    <span className="pid-context-menu-shortcut">default</span>
                  ) : null}
                </RadixDropdown.Item>
              ))
            )}
            <RadixDropdown.Separator className="pid-context-menu-separator" />
            <RadixDropdown.Item className="pid-context-menu-item" onSelect={openSettings}>
              <span className="pid-context-menu-icon" aria-hidden>
                <Settings size={14} aria-hidden />
              </span>
              <span className="pid-context-menu-label">Terminal settings…</span>
            </RadixDropdown.Item>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>
    </div>
  );
}
