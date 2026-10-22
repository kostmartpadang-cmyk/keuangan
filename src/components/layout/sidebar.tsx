"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { BrandMark } from "./brand-mark";
import { useOptimisticNav } from "@/hooks/use-optimistic-nav";
import { NAV_ITEMS } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar({ displayName, email }: { displayName: string | null; email: string }) {
  const pathname = usePathname();
  const { isActiveHref, onNavigate } = useOptimisticNav(pathname);

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-2 pt-1">
        <BrandMark />
        <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
      </Link>

      <Button render={<Link href="/transactions/new" />} nativeButton={false} size="lg" className="h-10 justify-center rounded-xl">
        <Plus aria-hidden /> Tambah transaksi
      </Button>

      <nav aria-label="Navigasi utama" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActiveHref(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => onNavigate(href)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="grid gap-2 border-t pt-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{displayName ?? "Pengguna"}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <ThemeToggle />
        </div>
        <form action={logout}>
          <Button type="submit" variant="ghost" className="w-full justify-start gap-2 text-muted-foreground">
            <LogOut aria-hidden /> Keluar
          </Button>
        </form>
      </div>
    </aside>
  );
}
