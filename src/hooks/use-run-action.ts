"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/**
 * Menjalankan Server Action dengan toast. Saat offline, aksi TIDAK dikirim dan pengguna diberi tahu
 * bahwa perubahan belum tersimpan (aplikasi tidak mengantrekan penulisan offline).
 */
export function useRunAction() {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    <T,>(
      action: () => Promise<ActionResult<T>>,
      opts: {
        onSuccess?: (res: Extract<ActionResult<T>, { ok: true }>) => void;
        onError?: (res: Extract<ActionResult<T>, { ok: false }>) => void;
        silentSuccess?: boolean;
      } = {},
    ) => {
      startTransition(async () => {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          toast.error("Anda sedang offline. Perubahan belum tersimpan — coba lagi saat tersambung.");
          return;
        }
        try {
          const res = await action();
          if (res.ok) {
            if (!opts.silentSuccess && res.message) toast.success(res.message);
            opts.onSuccess?.(res);
          } else {
            toast.error(res.error);
            opts.onError?.(res);
          }
        } catch (error) {
          // NEXT_REDIRECT dilempar ulang oleh Next; selain itu berarti jaringan/server bermasalah.
          if (error && typeof error === "object" && "digest" in error) throw error;
          toast.error("Tidak dapat terhubung ke server. Perubahan belum tersimpan.");
        }
      });
    },
    [],
  );

  return { run, pending };
}
