"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BudgetPeriodType } from "@/lib/types";

const LABELS: Record<BudgetPeriodType, string> = { weekly: "Mingguan", monthly: "Bulanan" };

/** Kedua panel dirender di server sekali; berpindah tab hanya menampilkan/menyembunyikan tanpa permintaan jaringan. */
export function BudgetTabs({
  initial,
  panels,
}: {
  initial: BudgetPeriodType;
  panels: Record<BudgetPeriodType, ReactNode>;
}) {
  const [type, setType] = useState<BudgetPeriodType>(initial);

  function select(t: BudgetPeriodType) {
    setType(t);
    window.history.replaceState(null, "", t === "weekly" ? "/budgets" : "/budgets?tab=monthly");
  }

  return (
    <div className="grid gap-5">
      <div role="tablist" aria-label="Jenis anggaran" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:w-80">
        {(["weekly", "monthly"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => select(t)}
            className={cn(
              "rounded-xl py-2 text-center text-sm font-semibold transition-colors",
              type === t ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      {(["weekly", "monthly"] as const).map((t) => (
        <div key={t} role="tabpanel" hidden={type !== t} className="grid gap-5">
          {panels[t]}
        </div>
      ))}
    </div>
  );
}
