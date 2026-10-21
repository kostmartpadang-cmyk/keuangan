import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
        <WifiOff className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">Anda sedang offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        RuangUang membutuhkan koneksi internet untuk membaca dan menyimpan data. Tidak ada transaksi yang disimpan saat
        offline. Sambungkan kembali perangkat Anda lalu muat ulang halaman.
      </p>
    </div>
  );
}
