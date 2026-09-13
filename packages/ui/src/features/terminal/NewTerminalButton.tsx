import type { TerminalShell } from "@pi-deck/core/protocol/commands.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Plus, Settings } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { useI18nContext } from "../../i18n/i18n-react.js";
import { useSettingsStore } from "../settings/useSettingsStore.js";
import { ShellTypeIcon } from "./terminalShellIcon.js";
import { useDetectedShells } from "./useDetectedShells.js";
import { useTerminalSettingsStore } from "./useTerminalSettingsStore.js";

export interface NewTerminalButtonProps {
  /** Open a new terminal. Pass a shell to launch that kind; omit for the default shell. */
  onNew: (shell?: TerminalShell) => void;
  /** When true the control is inert (e.g. no project open, so there is nowhere to spawn). */
  disabled?: boolean;
}

/**
 * The tab strip's "new terminal" control: a `+` that opens the default shell plus an adjacent
 * caret that opens a flyout of every detected shell. The two halves read as one split button.
 * Picking a shell opens a new tab running it; the effective default is marked.
 */
export function NewTerminalButton({ onNew, disabled }: NewTerminalButtonProps) {
  const { LL } = useI18nContext();
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
      <Tooltip content={LL.terminal.new.label()}>
        <button
          type="button"
          className="pid-terminal-tab-new"
          aria-label={LL.terminal.new.label()}
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
            aria-label={LL.terminal.new.chooseType()}
            disabled={disabled}
          >
            <ChevronDown size={11} aria-hidden />
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content align="end" sideOffset={6} className="pid-context-menu">
            {shells.length === 0 ? (
              <RadixDropdown.Item disabled className="pid-context-menu-item">
                <span className="pid-context-menu-label">{LL.terminal.new.noShells()}</span>
              </RadixDropdown.Item>
            ) : (
              shells.map((shell) => (
                <RadixDropdown.Item
                  key={`${shell.path} ${shell.args.join(" ")}`}
                  className="pid-context-menu-item"
                  onSelect={() => onNew(shell)}
                >
                  <span className="pid-context-menu-icon" aria-hidden>
                    <ShellTypeIcon kind={shell.kind} label={shell.label} />
                  </span>
                  <span className="pid-context-menu-label">{shell.label}</span>
                  {shell.kind !== "wsl" && shell.path === effectiveDefault ? (
                    <span className="pid-context-menu-shortcut">
                      {LL.terminal.new.defaultBadge()}
                    </span>
                  ) : null}
                </RadixDropdown.Item>
              ))
            )}
            <RadixDropdown.Separator className="pid-context-menu-separator" />
            <RadixDropdown.Item className="pid-context-menu-item" onSelect={openSettings}>
              <span className="pid-context-menu-icon" aria-hidden>
                <Settings size={14} aria-hidden />
              </span>
              <span className="pid-context-menu-label">{LL.terminal.new.settings()}</span>
            </RadixDropdown.Item>
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>
    </div>
  );
}
