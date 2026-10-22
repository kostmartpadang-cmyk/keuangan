"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/actions/push";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyToUint8(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

/** Status dan aksi notifikasi push di perangkat ini (dipakai tombol di Pengaturan, menu, dan banner). */
export function usePushNotifications() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supported =
        VAPID_PUBLIC_KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) return !cancelled && setState("unsupported");
      if (Notification.permission === "denied") return !cancelled && setState("denied");
      try {
        const sub = await currentSubscription();
        if (!cancelled) setState(sub && Notification.permission === "granted" ? "on" : "off");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToUint8(VAPID_PUBLIC_KEY) }));
      const json = sub.toJSON();
      const res = await savePushSubscription({
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
      });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        toast.error(res.error);
        return;
      }
      setState("on");
      toast.success(res.message ?? "Notifikasi diaktifkan.");
    } catch {
      toast.error("Notifikasi gagal diaktifkan di perangkat ini.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const sub = await currentSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Notifikasi dimatikan.");
    } catch {
      toast.error("Notifikasi gagal dimatikan.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await sendTestNotification();
    setBusy(false);
    if (res.ok) toast.success(res.message ?? "Terkirim.");
    else toast.error(res.error);
  }

  return { state, busy, enable, disable, test };
}

/** Tombol aktifkan/matikan notifikasi push di perangkat ini (masuk ke bilah notifikasi HP). */
export function NotificationToggle({ className }: { className?: string }) {
  const { state, busy, enable, disable, test } = usePushNotifications();

  if (state === "loading") return null;

  if (state === "unsupported") {
    return (
      <p className="text-xs text-muted-foreground">
        Notifikasi belum tersedia di browser ini. Di iPhone, pasang aplikasi ke Layar Utama dulu (iOS 16.4+), lalu buka dari ikonnya.
      </p>
    );
  }
  if (state === "denied") {
    return (
      <p className="text-xs text-muted-foreground">
        Notifikasi diblokir. Aktifkan izin notifikasi untuk situs ini di pengaturan browser/HP, lalu muat ulang halaman.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {state === "on" ? (
        <>
          <Button type="button" variant="outline" className="h-10 rounded-xl" onClick={disable} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <BellOff aria-hidden />} Matikan notifikasi
          </Button>
          <Button type="button" variant="ghost" className="h-10 rounded-xl" onClick={test} disabled={busy}>
            Kirim notifikasi tes
          </Button>
        </>
      ) : (
        <Button type="button" className="h-10 rounded-xl" onClick={enable} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Bell aria-hidden />} Aktifkan notifikasi
        </Button>
      )}
    </div>
  );
}

const DISMISS_KEY = "ruanguang-notif-dismissed";

/** Ajakan mengaktifkan notifikasi di Beranda; hilang setelah aktif atau ditutup (diingat per-perangkat). */
export function NotificationBanner() {
  const { state, busy, enable } = usePushNotifications();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (state !== "off" || dismissed) return null;

  return (
    <div className="animate-fade-up flex items-center gap-3 rounded-2xl border bg-accent/60 p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Bell className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Aktifkan notifikasi</p>
        <p className="text-xs text-muted-foreground">Dapat peringatan di HP saat sisa anggaran mingguan tinggal 10%.</p>
      </div>
      <Button type="button" className="h-9 rounded-xl" onClick={enable} disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />} Aktifkan
      </Button>
      <button
        type="button"
        aria-label="Tutup ajakan notifikasi"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // Tanpa localStorage, cukup tutup untuk sesi ini.
          }
          setDismissed(true);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
