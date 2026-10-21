"use client";

import { useEffect } from "react";

/** Mendaftarkan service worker (hanya produksi). SW hanya menyediakan halaman offline; data tidak di-cache. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Pendaftaran gagal bukan masalah fatal; aplikasi tetap berjalan normal.
    });
  }, []);
  return null;
}
