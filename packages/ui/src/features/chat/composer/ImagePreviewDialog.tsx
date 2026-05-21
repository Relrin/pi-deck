import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "../../../components/icons/index.js";

export interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Full data URL (`data:image/png;base64,…`) or fallback http(s) URL. */
  src: string;
  /** Display label, e.g. "Pasted image" or original filename. */
  name?: string;
}

/**
 * Click-to-zoom for staged or sent image attachments. Reuses the existing modal chrome
 * (`pid-modal-backdrop` / `pid-modal`) so the grain overlay sits below, and Radix gives
 * us Esc-to-close + focus management for free.
 */
export function ImagePreviewDialog({ open, onOpenChange, src, name }: ImagePreviewDialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="pid-modal-backdrop" />
        <RadixDialog.Content
          className="pid-modal pid-image-preview"
          style={{ width: "min(960px, 92vw)", maxHeight: "92vh" }}
          // Radix warns if there's no Description; for a lightbox the image *is* the
          // content so we opt out of aria-describedby explicitly. The `alt` on the <img>
          // below still provides the screen-reader label.
          aria-describedby={undefined}
        >
          <div className="pid-image-preview-header">
            <RadixDialog.Title className="pid-modal-title" title={name}>
              {name ?? "Image"}
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <button type="button" className="pid-image-preview-close" aria-label="Close preview">
                <X size={14} aria-hidden />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="pid-image-preview-body">
            <img src={src} alt={name ?? "Attached image"} draggable={false} />
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
