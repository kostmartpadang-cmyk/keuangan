"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, PlusSquare, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { APP_NAME } from "@/lib/constants";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Store kecil di level modul: `beforeinstallprompt` hanya dikirim sekali, jadi harus ditangkap sedini mungkin.
let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

declare global {
  interface Window {
    __bip?: BeforeInstallPromptEvent;
  }
}

if (typeof window !== "undefined") {
  // Event bisa sudah ditangkap oleh script awal di <head> sebelum modul ini dimuat.
  if (window.__bip) deferred = window.__bip;
  window.addEventListener("bip-ready", () => {
    deferred = window.__bip ?? null;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

type Mode = "hidden" | "prompt" | "ios" | "manual";

function getMode(): Mode {
  if (installed || isStandalone()) return "hidden";
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  // HP Android tanpa prompt otomatis (browser lain / syarat belum terpenuhi): tampilkan petunjuk manual.
  if (/android/i.test(navigator.userAgent)) return "manual";
  return "hidden";
}

function useInstallMode(): Mode {
  return useSyncExternalStore(subscribe, getMode, () => "hidden");
}

function ManualGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pasang {APP_NAME} di Android</DialogTitle>
          <DialogDescription>Browser Anda belum menawarkan pemasangan otomatis. Pasang lewat menu browser.</DialogDescription>
        </DialogHeader>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            Buka situs ini di <strong>Chrome</strong> (paling andal).
          </li>
          <li>
            Ketuk menu <strong>⋮</strong> di pojok kanan atas.
          </li>
          <li>
            Pilih <strong>Instal aplikasi</strong> atau <strong>Tambahkan ke layar utama</strong>.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Jika opsinya tidak ada, muat ulang halaman lalu coba lagi, atau pastikan Anda membuka situs lewat https.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function IosGuide({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pasang {APP_NAME} di iPhone/iPad</DialogTitle>
          <DialogDescription>Buka situs ini di Safari, lalu ikuti langkah berikut.</DialogDescription>
        </DialogHeader>
        <ol className="grid gap-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Share className="size-4" aria-hidden />
            </span>
            Ketuk tombol <strong>Bagikan</strong> di bilah Safari.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <PlusSquare className="size-4" aria-hidden />
            </span>
            Pilih <strong>Tambah ke Layar Utama</strong>.
          </li>
          <li className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground text-xs font-bold">
              ✓
            </span>
            Ketuk <strong>Tambah</strong>. Ikon {APP_NAME} muncul di layar utama.
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}

/** Tombol pasang aplikasi: dialog bawaan di Android/Chrome, petunjuk manual di iOS. Tersembunyi bila sudah terpasang. */
export function InstallButton({
  className,
  variant = "outline",
  label = "Pasang aplikasi",
}: {
  className?: string;
  variant?: "outline" | "default" | "ghost";
  label?: string;
}) {
  const mode = useInstallMode();
  const [guide, setGuide] = useState(false);
  if (mode === "hidden") return null;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        className={className}
        onClick={async () => {
          if (mode === "ios" || mode === "manual") return setGuide(true);
          const event = deferred;
          if (!event) return;
          await event.prompt();
          await event.userChoice;
          deferred = null; // prompt hanya bisa dipakai sekali
          emit();
        }}
      >
        <Download aria-hidden /> {mode === "manual" ? "Cara pasang aplikasi" : label}
      </Button>
      {mode === "manual" ? (
        <ManualGuide open={guide} onOpenChange={setGuide} />
      ) : (
        <IosGuide open={guide} onOpenChange={setGuide} />
      )}
    </>
  );
}

const DISMISS_KEY = "ruanguang-install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Banner ajakan pasang di HP; bisa ditutup dan diingat per-perangkat. */
export function InstallBanner() {
  const mode = useInstallMode();
  const [dismissed, setDismissed] = useState(readDismissedSafe);
  if (mode === "hidden" || dismissed) return null;

  return (
    <div className="animate-fade-up mb-4 flex items-center gap-3 rounded-2xl border bg-accent/60 p-3 md:hidden">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
        R
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Pasang {APP_NAME}</p>
        <p className="text-xs text-muted-foreground">Buka cepat dari layar utama, tampil layar penuh.</p>
      </div>
      <InstallButton variant="default" label="Pasang" className="h-9 rounded-xl" />
      <button
        type="button"
        aria-label="Tutup ajakan pasang aplikasi"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, "1");
          } catch {
            // localStorage bisa tidak tersedia (mode privat); cukup tutup untuk sesi ini.
          }
          setDismissed(true);
        }}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function readDismissedSafe() {
  return typeof window === "undefined" ? false : readDismissed();
}
