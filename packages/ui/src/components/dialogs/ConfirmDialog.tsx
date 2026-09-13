import { useState } from "react";
import { useI18nContext } from "../../i18n/i18n-react.js";
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
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const { LL } = useI18nContext();
  const [busy, setBusy] = useState(false);

  const confirmText = confirmLabel ?? LL.shell.components.confirmDialog.confirm();
  const cancelText = cancelLabel ?? LL.common.cancel();

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
        <PidButton variant="ghost" longLabel onClick={() => onOpenChange(false)} disabled={busy}>
          {cancelText}
        </PidButton>
        <PidButton
          variant={destructive ? "danger" : "primary"}
          longLabel
          onClick={handleConfirm}
          disabled={busy}
        >
          {confirmText}
        </PidButton>
      </div>
    </Dialog>
  );
}
