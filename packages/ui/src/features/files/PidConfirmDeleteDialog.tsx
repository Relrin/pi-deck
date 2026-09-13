import { useState } from "react";
import { PidButton } from "../../components/buttons/PidButton.js";
import { Dialog } from "../../components/ui/Dialog.js";
import { useI18nContext } from "../../i18n/i18n-react.js";

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
  const { LL } = useI18nContext();
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
  const title = LL.files.confirmDeleteTitle({ count: paths.length });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={LL.files.confirmDeleteDescription()}
    >
      <ul className="pid-tree-delete-list">
        {visible.map((p) => (
          <li key={p} title={p}>
            {relativise(p, projectRoot)}
          </li>
        ))}
        {overflow > 0 && (
          <li className="pid-tree-delete-overflow">{LL.files.moreItems({ count: overflow })}</li>
        )}
      </ul>
      <div className="pid-tree-delete-actions">
        <PidButton variant="ghost" longLabel onClick={() => onOpenChange(false)} disabled={busy}>
          {LL.common.cancel()}
        </PidButton>
        <PidButton variant="danger" longLabel onClick={handleConfirm} disabled={busy}>
          {busy ? LL.files.confirmDeleteBusy() : LL.files.confirmDelete()}
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
