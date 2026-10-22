"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Plus } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useOptimisticNav } from "@/hooks/use-optimistic-nav";
import { isActive, NAV_ITEMS } from "./nav-config";
import { InstallButton } from "@/components/pwa/install";
import { ThemeToggle } from "./theme-toggle";

const PRIMARY = NAV_ITEMS.filter((i) => ["/dashboard", "/transactions", "/budgets"].includes(i.href));
const MORE = NAV_ITEMS.filter((i) => !PRIMARY.includes(i));

export function MobileNav() {
  const pathname = usePathname();
  const { isActiveHref, onNavigate } = useOptimisticNav(pathname);
  const [open, setOpen] = useState(false);
  const moreActive = MORE.some((i) => isActive(pathname, i.href));

  const tab = (href: string, label: string, Icon: (typeof NAV_ITEMS)[number]["icon"]) => {
    const active = isActiveHref(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => onNavigate(href)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
    );
  };

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 flex items-end border-t bg-background/95 backdrop-blur md:hidden"
      >
        {PRIMARY.slice(0, 2).map((i) => tab(i.href, i.label, i.icon))}

        <div className="flex flex-1 justify-center">
          <Link
            href="/transactions/new"
            aria-label="Tambah transaksi"
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-6" aria-hidden />
          </Link>
        </div>

        {PRIMARY.slice(2).map((i) => tab(i.href, i.label, i.icon))}

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Menu lainnya"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
            moreActive ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Menu className="size-5" aria-hidden />
          Menu
        </button>
      </nav>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-8">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 px-4">
            {MORE.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium",
                  isActive(pathname, href) && "border-primary/40 bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            ))}
          </div>
          <div className="px-4 empty:hidden">
            <InstallButton className="h-11 w-full rounded-2xl" />
          </div>
          <div className="flex items-center justify-between gap-2 px-4">
            <ThemeToggle withLabel />
            <form action={logout}>
              <Button type="submit" variant="ghost" className="gap-2 text-muted-foreground">
                <LogOut aria-hidden /> Keluar
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
