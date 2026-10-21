"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-expense-soft text-expense">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">Data tidak dapat dimuat</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Terjadi kesalahan saat mengambil data. Periksa koneksi internet Anda lalu coba lagi. Jika terus berulang, pastikan migration
        database sudah dijalankan.
      </p>
      <Button onClick={reset} className="h-10 rounded-xl">
        Coba lagi
      </Button>
    </div>
  );
}
