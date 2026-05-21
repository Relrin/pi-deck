import type { PromptAttachment } from "@pi-deck/core/protocol/commands.js";
import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import { File, FileText, Folder, Image, Paperclip, Search } from "../../components/icons/index.js";
import { metaSymbol, shiftSymbol } from "../../lib/platform.js";
import { useIntroComposerStore } from "./useIntroComposerStore.js";
import { useRecentAttachmentsStore } from "./useRecentAttachmentsStore.js";

interface PidAttachmentsPickerProps {
  onChooseFiles: () => void;
  onChooseFolder: () => void;
  onOpenRepoSearch: () => void;
  onPickRecent: (attachment: PromptAttachment) => void;
  /** Optional — when provided, an "Attach image…" entry appears in the menu. */
  onChooseImage?: () => void;
}

export function PidAttachmentsPicker({
  onChooseFiles,
  onChooseFolder,
  onOpenRepoSearch,
  onPickRecent,
  onChooseImage,
}: PidAttachmentsPickerProps) {
  const attachments = useIntroComposerStore((s) => s.attachments);
  const images = useIntroComposerStore((s) => s.images);
  const recents = useRecentAttachmentsStore((s) => s.entries);

  const meta = metaSymbol();
  const shift = shiftSymbol();

  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>
        <button
          type="button"
          className="pid-picker-trigger pid-picker-trigger-icon-only"
          aria-label="Attach files or folders"
          data-has-attachments={attachments.length + images.length > 0 || undefined}
        >
          <Paperclip size={14} />
          {attachments.length + images.length > 0 && (
            <span className="pid-picker-trigger-badge">{attachments.length + images.length}</span>
          )}
        </button>
      </RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          align="start"
          side="top"
          sideOffset={6}
          className="pid-picker-menu"
          style={{ minWidth: 300 }}
        >
          <div className="pid-picker-menu-header">Attach</div>
          <RadixDropdown.Item className="pid-picker-menu-item" onSelect={onChooseFiles}>
            <span className="pid-picker-menu-item-check" aria-hidden>
              <FileText size={14} />
            </span>
            <span className="pid-picker-menu-item-label">Add files</span>
            <span className="pid-picker-menu-item-sub pid-picker-menu-item-kbd">
              <kbd className="pid-kbd">{meta}</kbd>
              <kbd className="pid-kbd">O</kbd>
            </span>
          </RadixDropdown.Item>
          {onChooseImage && (
            <RadixDropdown.Item className="pid-picker-menu-item" onSelect={onChooseImage}>
              <span className="pid-picker-menu-item-check" aria-hidden>
                <Image size={14} />
              </span>
              <span className="pid-picker-menu-item-label">Attach image</span>
              <span className="pid-picker-menu-item-sub">paste · drop · pick</span>
            </RadixDropdown.Item>
          )}
          <RadixDropdown.Item className="pid-picker-menu-item" onSelect={onChooseFolder}>
            <span className="pid-picker-menu-item-check" aria-hidden>
              <Folder size={14} />
            </span>
            <span className="pid-picker-menu-item-label">Add folder</span>
            <span className="pid-picker-menu-item-sub pid-picker-menu-item-kbd">
              <kbd className="pid-kbd">{meta}</kbd>
              <kbd className="pid-kbd">{shift}</kbd>
              <kbd className="pid-kbd">O</kbd>
            </span>
          </RadixDropdown.Item>
          <RadixDropdown.Item
            className="pid-picker-menu-item"
            onSelect={(e) => {
              // Radix closes the menu on select — that's fine, we open the modal next tick.
              e.preventDefault();
              onOpenRepoSearch();
            }}
          >
            <span className="pid-picker-menu-item-check" aria-hidden>
              <Search size={14} />
            </span>
            <span className="pid-picker-menu-item-label">Reference from repo</span>
            <span className="pid-picker-menu-item-sub pid-picker-menu-item-kbd">
              <kbd className="pid-kbd">@</kbd>
            </span>
          </RadixDropdown.Item>

          {recents.length > 0 && (
            <>
              <RadixDropdown.Separator className="pid-picker-menu-sep" />
              <div className="pid-picker-menu-header">Recent</div>
              {recents.map((a) => (
                <RadixDropdown.Item
                  key={`${a.kind}|${a.path}`}
                  className="pid-picker-menu-item pid-picker-menu-item-recent"
                  onSelect={() => onPickRecent(a)}
                >
                  <span className="pid-picker-menu-item-check" aria-hidden>
                    {a.kind === "folder" ? <Folder size={14} /> : <File size={14} />}
                  </span>
                  <span
                    className="pid-picker-menu-item-label pid-picker-menu-item-recent-path"
                    title={a.path}
                  >
                    {a.path}
                  </span>
                </RadixDropdown.Item>
              ))}
            </>
          )}

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
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
