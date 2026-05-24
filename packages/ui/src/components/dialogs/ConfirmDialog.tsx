import { useState } from "react";
import { PidButton } from "../buttons/PidButton.js";
import { Dialog } from "../ui/Dialog.js";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true, the confirm button styles as a destructive action. */
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="flex justify-end gap-2">
        <PidButton variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
          {cancelLabel}
        </PidButton>
        <PidButton
          variant={destructive ? "danger" : "primary"}
          longLabel
          onClick={handleConfirm}
          disabled={busy}
        >
          {confirmLabel}
        </PidButton>
      </div>
    </Dialog>
  );
}
