import { useState } from "react";
import { PidButton } from "../../components/buttons/PidButton.js";
import { Dialog } from "../../components/ui/Dialog.js";

interface PidConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paths: string[];
  /** Project root absolute path; trimmed off the rendered list to keep things readable. */
  projectRoot: string;
  onConfirm: () => Promise<void> | void;
}

const MAX_VISIBLE_PATHS = 8;

export function PidConfirmDeleteDialog({
  open,
  onOpenChange,
  paths,
  projectRoot,
  onConfirm,
}: PidConfirmDeleteDialogProps) {
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

  const visible = paths.slice(0, MAX_VISIBLE_PATHS);
  const overflow = paths.length - visible.length;
  const title =
    paths.length === 1 ? "Move 1 item to Trash?" : `Move ${paths.length} items to Trash?`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Items can be restored from your operating system trash."
    >
      <ul className="pid-tree-delete-list">
        {visible.map((p) => (
          <li key={p} title={p}>
            {relativise(p, projectRoot)}
          </li>
        ))}
        {overflow > 0 && (
          <li className="pid-tree-delete-overflow">
            + {overflow} more {overflow === 1 ? "item" : "items"}
          </li>
        )}
      </ul>
      <div className="pid-tree-delete-actions">
        <PidButton variant="ghost" longLabel onClick={() => onOpenChange(false)} disabled={busy}>
          Cancel
        </PidButton>
        <PidButton variant="danger" longLabel onClick={handleConfirm} disabled={busy}>
          {busy ? "Moving…" : "Move to Trash"}
        </PidButton>
      </div>
    </Dialog>
  );
}

function relativise(absPath: string, root: string): string {
  const rootPosix = root.replace(/\\/g, "/");
  if (!rootPosix) return absPath;
  if (absPath === rootPosix) return ".";
  if (absPath.startsWith(`${rootPosix}/`)) return absPath.slice(rootPosix.length + 1);
  return absPath;
}
