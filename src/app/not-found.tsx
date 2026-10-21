import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-5xl font-extrabold text-primary">404</p>
      <h1 className="text-xl font-bold">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Halaman yang Anda cari tidak ada atau datanya sudah dihapus.</p>
      <Button render={<Link href="/dashboard" />} nativeButton={false} className="h-10 rounded-xl">
        Kembali ke beranda
      </Button>
    </div>
  );
}
