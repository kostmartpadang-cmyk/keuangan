"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      type="button"
      variant="ghost"
      size={withLabel ? "default" : "icon"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
    >
      {/* Kedua ikon dirender; CSS memilih yang tampil agar tidak ada mismatch hidrasi. */}
      <Sun className="hidden size-4 dark:block" aria-hidden />
      <Moon className="size-4 dark:hidden" aria-hidden />
      {withLabel && (
        <span>
          <span className="hidden dark:inline">Mode terang</span>
          <span className="dark:hidden">Mode gelap</span>
        </span>
      )}
    </Button>
  );
}
