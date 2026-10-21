"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRunAction } from "@/hooks/use-run-action";
import type { ActionResult } from "@/lib/action";

/** Tombol hapus dengan dialog konfirmasi. `action` dijalankan hanya setelah pengguna menyetujui. */
export function ConfirmDeleteButton({
  title,
  description,
  action,
  confirmLabel = "Hapus",
  ariaLabel,
  variant = "ghost",
  size = "icon-sm",
  children,
  onDone,
}: {
  title: string;
  description: string;
  action: () => Promise<ActionResult>;
  confirmLabel?: string;
  ariaLabel: string;
  variant?: "ghost" | "outline" | "destructive";
  size?: "icon-sm" | "icon" | "sm" | "default";
  children?: React.ReactNode;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, pending } = useRunAction();

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={ariaLabel}
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        {children ?? <Trash2 aria-hidden />}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={() =>
                run(action, {
                  onSuccess: () => {
                    setOpen(false);
                    onDone?.();
                  },
                  onError: () => setOpen(false),
                })
              }
            >
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
