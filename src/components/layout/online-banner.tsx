"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Banner status koneksi. Aplikasi tidak menyimpan perubahan saat offline. */
export function OnlineBanner() {
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-warning px-4 py-2 text-center text-xs font-medium text-background"
    >
      <WifiOff className="size-3.5 shrink-0" aria-hidden />
      Anda sedang offline. Perubahan belum bisa disimpan sampai koneksi kembali.
    </div>
  );
}
