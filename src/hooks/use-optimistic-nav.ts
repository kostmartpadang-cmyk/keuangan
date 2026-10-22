"use client";

import { useState } from "react";
import { isActive } from "@/components/layout/nav-config";

/**
 * Menu langsung tampak aktif begitu diketuk, tanpa menunggu halaman tujuan selesai dimuat.
 * Status "menunggu" otomatis gugur saat pathname berubah (mis. tujuan sudah tampil atau navigasi dibatalkan).
 */
export function useOptimisticNav(pathname: string) {
  const [target, setTarget] = useState<{ href: string; from: string } | null>(null);
  const pendingHref = target && target.from === pathname ? target.href : null;

  return {
    isActiveHref: (href: string) => (pendingHref ? isActive(pendingHref, href) : isActive(pathname, href)),
    onNavigate: (href: string) => setTarget({ href, from: pathname }),
  };
}
