import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { useState } from "react";
import { File, FileText, Folder, Paperclip, Search } from "../../components/icons/index.js";
import { useToastStore } from "../_status/useToastStore.js";
import { PidRepoFileSearchDialog } from "./PidRepoFileSearchDialog.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";

export function PidAttachmentsPicker() {
  const addAttachments = useIntroComposerStore((s) => s.addAttachments);
  const attachments = useIntroComposerStore((s) => s.attachments);
  const [repoSearchOpen, setRepoSearchOpen] = useState(false);

  const onChooseFiles = async () => {
    const picker = window.bridge?.openFiles;
    if (!picker) {
      useToastStore.getState().push("File picker unavailable in this build", "error");
      return;
    }
    const paths = await picker();
    if (paths.length === 0) return;
    addAttachments(paths.map((path) => ({ kind: "file" as const, path })));
  };

  const onChooseFolder = async () => {
    const picker = window.bridge?.openDirectory;
    if (!picker) {
      useToastStore.getState().push("Folder picker unavailable in this build", "error");
      return;
    }
    const path = await picker();
    if (!path) return;
    addAttachments([{ kind: "folder", path }]);
  };

  return (
    <>
      <RadixDropdown.Root>
        <RadixDropdown.Trigger asChild>
          <button
            type="button"
            className="pid-picker-trigger pid-picker-trigger-icon-only"
            aria-label="Attach files or folders"
            data-has-attachments={attachments.length > 0 || undefined}
          >
            <Paperclip size={14} />
            {attachments.length > 0 && (
              <span className="pid-picker-trigger-badge">{attachments.length}</span>
            )}
          </button>
        </RadixDropdown.Trigger>
        <RadixDropdown.Portal>
          <RadixDropdown.Content
            align="start"
            sideOffset={6}
            className="pid-picker-menu"
            style={{ minWidth: 280 }}
          >
            <div className="pid-picker-menu-header">Attach</div>
            <RadixDropdown.Item className="pid-picker-menu-item" onSelect={onChooseFiles}>
              <span className="pid-picker-menu-item-check" aria-hidden>
                <FileText size={14} />
              </span>
              <span className="pid-picker-menu-item-label">Choose files&hellip;</span>
            </RadixDropdown.Item>
            <RadixDropdown.Item className="pid-picker-menu-item" onSelect={onChooseFolder}>
              <span className="pid-picker-menu-item-check" aria-hidden>
                <Folder size={14} />
              </span>
              <span className="pid-picker-menu-item-label">Choose folder&hellip;</span>
            </RadixDropdown.Item>
            <RadixDropdown.Item
              className="pid-picker-menu-item"
              onSelect={(e) => {
                // Radix closes the menu on select — that's fine, we open the modal next tick.
                e.preventDefault();
                setRepoSearchOpen(true);
              }}
            >
              <span className="pid-picker-menu-item-check" aria-hidden>
                <Search size={14} />
              </span>
              <span className="pid-picker-menu-item-label">Reference from repo&hellip;</span>
            </RadixDropdown.Item>
            {attachments.length > 0 && (
              <>
                <RadixDropdown.Separator className="pid-picker-menu-sep" />
                <div className="pid-picker-menu-header">Currently attached</div>
                {attachments.map((a) => (
                  <div
                    key={`${a.kind}|${a.path}`}
                    className="pid-picker-menu-item pid-picker-menu-readonly"
                  >
                    <span className="pid-picker-menu-item-check" aria-hidden>
                      {a.kind === "folder" ? <Folder size={12} /> : <File size={12} />}
                    </span>
                    <span className="pid-picker-menu-item-label" title={a.path}>
                      {basename(a.path)}
                    </span>
                    <span className="pid-picker-menu-item-sub">{a.kind}</span>
                  </div>
                ))}
              </>
            )}
          </RadixDropdown.Content>
        </RadixDropdown.Portal>
      </RadixDropdown.Root>
      {repoSearchOpen && (
        <PidRepoFileSearchDialog
          open={repoSearchOpen}
          onClose={() => setRepoSearchOpen(false)}
          onSelect={(picks) => {
            addAttachments(picks.map<PromptAttachment>((path) => ({ kind: "repo-ref", path })));
            setRepoSearchOpen(false);
          }}
        />
      )}
    </>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
