"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription, sendTestNotification } from "@/actions/push";
import { Button } from "@/components/ui/button";

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

/** Tombol aktifkan/matikan notifikasi push di perangkat ini (masuk ke bilah notifikasi HP). */
export function NotificationToggle() {
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
    <div className="flex flex-wrap gap-2">
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
