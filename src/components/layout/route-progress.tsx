"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** Garis kemajuan tipis di atas layar selama perpindahan halaman, sebagai umpan balik instan saat server masih bekerja. */
function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const key = `${pathname}?${search}`;
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const pending = pendingFrom === key;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setPendingFrom(`${location.pathname}?${location.search.replace(/^\?/, "")}`);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Jaring pengaman: jangan biarkan bar menggantung bila navigasi dibatalkan.
  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => setPendingFrom(null), 10000);
    return () => clearTimeout(t);
  }, [pending]);

  if (!pending) return null;
  return (
    <div role="progressbar" aria-label="Memuat halaman" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/15">
      <div className="h-full w-1/3 animate-[route-progress_1s_ease-in-out_infinite] rounded-full bg-primary" />
    </div>
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
