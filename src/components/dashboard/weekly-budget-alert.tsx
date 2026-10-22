"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Toast sekali per minggu saat sisa anggaran mingguan tinggal 10% atau kurang; juga notifikasi browser bila sudah diizinkan. */
export function WeeklyBudgetAlert({ weekStart, message }: { weekStart: string; message: string }) {
  useEffect(() => {
    const key = `ruanguang-weekly-low-${weekStart}`;
    try {
      if (localStorage.getItem(key) === "1") return;
      localStorage.setItem(key, "1");
    } catch {
      // Tanpa localStorage, toast tetap tampil di setiap kunjungan.
    }
    toast.warning("Anggaran mingguan hampir habis", { description: message, duration: 10000 });
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Anggaran mingguan hampir habis", { body: message });
      }
    } catch {
      // Notifikasi browser opsional.
    }
  }, [weekStart, message]);
  return null;
}
