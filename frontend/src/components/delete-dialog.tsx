"use client";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { withToast } from "@/lib/toast";

export interface DeleteTarget {
  noun: string;
  name: string;
  remove: () => Promise<unknown>;
}

interface DeleteDialogProps {
  target: DeleteTarget | null;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteDialog({ target, onClose, onDeleted }: DeleteDialogProps) {
  const remove = async () => {
    if (!target) return false;
    // a blocked delete comes back as a 409 whose message the toast shows
    const done = await withToast(target.remove(), `${target.name} deleted`);
    if (done) onDeleted();
    return done;
  };

  return (
    <ConfirmDialog
      open={target !== null}
      onOpenChange={(open) => !open && onClose()}
      title={target ? `Delete ${target.noun} ${target.name}?` : ""}
      description="This can't be undone. It is refused if other records still depend on it."
      confirmLabel="Delete"
      destructive
      onConfirm={remove}
    />
  );
}
