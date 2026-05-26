import type { PromptAttachment, PromptImage } from "@pi-deck/core/protocol/commands.js";
import {
  type DragEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Folder, Send, Square, X } from "../../components/icons/index.js";
import { Tooltip } from "../../components/ui/Tooltip.js";
import { useAutoGrowTextarea } from "../../lib/useAutoGrowTextarea.js";
import { useToastStore } from "../_status/useToastStore.js";
import { PidAttachmentsPicker } from "../intro/PidAttachmentsPicker.js";
import { PidRepoFileSearchDialog } from "../intro/PidRepoFileSearchDialog.js";
import { useAttachmentsHotkeys } from "../intro/useAttachmentsHotkeys.js";
import { type PromptImageDraft, useIntroComposerStore } from "../intro/useIntroComposerStore.js";
import { useRecentAttachmentsStore } from "../intro/useRecentAttachmentsStore.js";
import { useSessionsStore } from "../sessions/useSessionsStore.js";
import { ContextUsageIndicator } from "./composer/ContextUsageIndicator.js";
import { ImagePreviewDialog } from "./composer/ImagePreviewDialog.js";
import { SessionAgentModePicker } from "./composer/SessionAgentModePicker.js";
import { SessionEffortPicker } from "./composer/SessionEffortPicker.js";
import { SessionModelPicker } from "./composer/SessionModelPicker.js";
import { useComposerStore } from "./composer/useComposerStore.js";
import { useImagePaste } from "./composer/useImagePaste.js";
import type { UserMessageImage } from "./types.js";
import { useDraftStore } from "./useDraftStore.js";
import { selectTurnInFlight, useMessagesStore } from "./useMessagesStore.js";

const PLACEHOLDER = "Send a message…  @ files · / commands · ! shell";

export function MessageInput({ sessionId }: { sessionId: string }) {
  const [text, setText] = useState("");
  const isInFlight = useMessagesStore(useMemo(() => selectTurnInFlight(sessionId), [sessionId]));
  const sendPrompt = useSessionsStore((s) => s.sendPrompt);
  const cancelPrompt = useSessionsStore((s) => s.cancelPrompt);
  const executionMode = useComposerStore((s) => s.executionMode);
  const pendingInsert = useDraftStore((s) => s.pendingInsert);
  const consumePendingInsert = useDraftStore((s) => s.consumePendingInsert);

  // Attachments share the intro composer store: the BLANK tab and SESSION tab both consume
  // the same "next prompt attachments" queue, so files staged from one surface survive
  // navigation between the two. The list is cleared after a successful Send.
  const attachments = useIntroComposerStore((s) => s.attachments);
  const addAttachments = useIntroComposerStore((s) => s.addAttachments);
  const removeAttachment = useIntroComposerStore((s) => s.removeAttachment);
  const clearAttachments = useIntroComposerStore((s) => s.clearAttachments);
  const images = useIntroComposerStore((s) => s.images);
  const addImages = useIntroComposerStore((s) => s.addImages);
  const removeImage = useIntroComposerStore((s) => s.removeImage);
  const clearImages = useIntroComposerStore((s) => s.clearImages);
  const pushRecent = useRecentAttachmentsStore((s) => s.push);

  const [repoSearchOpen, setRepoSearchOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<PromptImageDraft | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const dragDepthRef = useRef(0);

  useAutoGrowTextarea(ref, text);
  const { onPaste, onDrop, onDragOver, chooseImage } = useImagePaste({ onImages: addImages });

  const onComposerDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      dragDepthRef.current = 0;
      setDragOver(false);
      onDrop(e);
    },
    [onDrop],
  );
  const onComposerDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    if (!e.dataTransfer?.types.includes("Files")) return;
    dragDepthRef.current += 1;
    setDragOver(true);
  }, []);
  const onComposerDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragOver(false);
  }, []);

  // "Attach selection to next prompt" pushes through useDraftStore; consume it into the
  // local textarea state so the user can edit before sending.
  useEffect(() => {
    if (pendingInsert === undefined) return;
    const value = consumePendingInsert();
    if (value === undefined) return;
    setText((prev) => {
      if (!prev) return value;
      const separator = prev.endsWith("\n") ? "" : "\n";
      return `${prev}${separator}${value}`;
    });
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [pendingInsert, consumePendingInsert]);

  const attachAndRemember = useCallback(
    (next: PromptAttachment[]) => {
      if (next.length === 0) return;
      addAttachments(next);
      for (const a of next) pushRecent(a);
    },
    [addAttachments, pushRecent],
  );

  const chooseFiles = useCallback(async () => {
    const picker = window.bridge?.openFiles;
    if (!picker) {
      useToastStore.getState().push("File picker unavailable in this build", "error");
      return;
    }
    const paths = await picker();
    if (paths.length === 0) return;
    attachAndRemember(paths.map((path) => ({ kind: "file" as const, path })));
  }, [attachAndRemember]);

  const chooseFolder = useCallback(async () => {
    const picker = window.bridge?.openDirectory;
    if (!picker) {
      useToastStore.getState().push("Folder picker unavailable in this build", "error");
      return;
    }
    const path = await picker();
    if (!path) return;
    attachAndRemember([{ kind: "folder", path }]);
  }, [attachAndRemember]);

  const openRepoSearch = useCallback(() => setRepoSearchOpen(true), []);

  // Cmd/Ctrl+O and Cmd/Ctrl+Shift+O fire at window scope so they keep working while the
  // attachments popover or any modal portal has focus. (Mirrors the BLANK tab.)
  useAttachmentsHotkeys({ onChooseFiles: chooseFiles, onChooseFolder: chooseFolder });

  const cancel = useCallback(() => {
    void cancelPrompt();
  }, [cancelPrompt]);

  // Esc cancels the in-flight turn. Mounted globally while a turn is in flight so the user
  // can interrupt from anywhere in the app, not only from the textarea.
  useEffect(() => {
    if (!isInFlight) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.defaultPrevented) return;
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      cancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isInFlight, cancel]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // `@` at a word boundary opens the repo file search modal — same UX as BLANK tab.
    if (e.key === "@" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const target = e.currentTarget;
      const caret = target.selectionStart ?? 0;
      const prev = caret > 0 ? target.value[caret - 1] : "";
      const atBoundary = caret === 0 || !prev || /\s/.test(prev);
      if (atBoundary) {
        e.preventDefault();
        openRepoSearch();
        return;
      }
    }
    if (e.key !== "Enter") return;
    if (e.shiftKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    submit();
  };

  const isEmpty = text.trim().length === 0;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isInFlight) return;
    // Snapshot the attachments BEFORE we optimistically clear the input — if the send
    // fails we restore the text but also need to know what to forward to pi.
    const sendingAttachments = attachments.slice();
    const sendingImages = images.slice();
    setText("");
    clearAttachments();
    clearImages();
    void dispatchPrompt(trimmed, sendingAttachments, sendingImages);
  };

  const dispatchPrompt = async (
    trimmed: string,
    sendingAttachments: PromptAttachment[],
    sendingImages: PromptImageDraft[],
  ) => {
    const wireImages: PromptImage[] | undefined =
      sendingImages.length > 0
        ? sendingImages.map((i) => ({ mimeType: i.mimeType, data: i.data, name: i.name }))
        : undefined;
    const messageImages: UserMessageImage[] | undefined =
      sendingImages.length > 0
        ? sendingImages.map((i) => ({
            thumbnailDataUrl: i.thumbnailDataUrl,
            name: i.name,
            mimeType: i.mimeType,
          }))
        : undefined;
    try {
      await sendPrompt(trimmed, {
        agentMode: executionMode,
        attachments: sendingAttachments.length > 0 ? sendingAttachments : undefined,
        images: wireImages,
        messageImages,
      });
    } catch {
      // Errors surface via toast in the store; restore the text + attachments + images
      // so the user can edit and retry without retyping or re-staging files.
      setText(trimmed);
      if (sendingAttachments.length > 0) addAttachments(sendingAttachments);
      if (sendingImages.length > 0) addImages(sendingImages);
    }
  };

  const hasChips = attachments.length > 0 || images.length > 0;

  return (
    <div className="pid-chat-composer">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: composer shell is a layout
          container; the textarea and chip buttons inside are the real interactive surfaces.
          Drop handlers live here only so the user can drop on the chip row, not just the textarea. */}
      <div
        className="pid-composer-shell"
        data-drag-over={dragOver || undefined}
        onDragEnter={onComposerDragEnter}
        onDragLeave={onComposerDragLeave}
        onDragOver={onDragOver}
        onDrop={onComposerDrop}
      >
        {hasChips && (
          <div className="pid-composer-attachments">
            {attachments.map((a) => (
              <span key={`${a.kind}|${a.path}`} className="pid-composer-attachment">
                {a.kind === "folder" ? <Folder size={11} /> : null}
                <span className="pid-composer-attachment-path" title={a.path}>
                  {basename(a.path)}
                </span>
                <button
                  type="button"
                  className="pid-composer-attachment-remove"
                  onClick={() => removeAttachment(a.path)}
                  aria-label={`Remove ${a.path}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {images.map((img) => (
              <div
                key={img.id}
                className="pid-composer-attachment pid-composer-attachment-image"
                title={img.name}
              >
                <button
                  type="button"
                  className="pid-composer-attachment-image-trigger"
                  aria-label={`Preview ${img.name}`}
                  onClick={() => setPreviewImage(img)}
                >
                  <img src={img.thumbnailDataUrl} alt={img.name} draggable={false} />
                </button>
                <button
                  type="button"
                  className="pid-composer-attachment-image-remove"
                  aria-label={`Remove ${img.name}`}
                  onClick={() => removeImage(img.id)}
                >
                  <X size={10} aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={PLACEHOLDER}
          aria-label="Message"
          aria-keyshortcuts="Enter"
          className="pid-composer-input"
        />
        <div className="pid-composer-row">
          <SessionAgentModePicker />
          <PidAttachmentsPicker
            onChooseFiles={chooseFiles}
            onChooseFolder={chooseFolder}
            onOpenRepoSearch={openRepoSearch}
            onPickRecent={(a) => attachAndRemember([a])}
            onChooseImage={() => void chooseImage()}
          />
          <span className="pid-composer-row-spacer" />
          <ContextUsageIndicator sessionId={sessionId} />
          <SessionModelPicker sessionId={sessionId} />
          <SessionEffortPicker sessionId={sessionId} />
          {isInFlight ? (
            <Tooltip content="Stop generating · Esc" side="top">
              <button
                type="button"
                onClick={cancel}
                className="pid-composer-stop"
                aria-label="Stop generating"
                aria-keyshortcuts="Escape"
              >
                <Square size={12} aria-hidden />
                <span>Stop</span>
              </button>
            </Tooltip>
          ) : (
            <Tooltip content="Send message · Enter" side="top">
              <button
                type="button"
                onClick={() => void submit()}
                disabled={isEmpty}
                className="pid-composer-send"
                aria-label="Send message"
                aria-keyshortcuts="Enter"
              >
                <Send size={12} aria-hidden />
                <span>Send</span>
              </button>
            </Tooltip>
          )}
        </div>
      </div>
      {repoSearchOpen && (
        <PidRepoFileSearchDialog
          open={repoSearchOpen}
          onClose={() => setRepoSearchOpen(false)}
          onSelect={(picks) => {
            attachAndRemember(picks.map<PromptAttachment>((path) => ({ kind: "repo-ref", path })));
            setRepoSearchOpen(false);
          }}
        />
      )}
      {previewImage && (
        <ImagePreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPreviewImage(null);
          }}
          src={`data:${previewImage.mimeType};base64,${previewImage.data}`}
          name={previewImage.name}
        />
      )}
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split(/[\\/]/);
  return parts[parts.length - 1] || p;
}
