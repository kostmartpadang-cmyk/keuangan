"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERIOD_LABELS, type Period, type PeriodKey } from "@/lib/dates";
import { buildQuery } from "@/lib/url";
import { cn } from "@/lib/utils";

const PRESETS: PeriodKey[] = ["today", "week", "month", "last_month"];

const dateCls =
  "min-w-0 max-w-full appearance-none h-9 w-full rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

const chipCls = (on: boolean) =>
  cn(
    "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
    on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
  );

/**
 * Filter periode berbasis URL (?p=&from=&to=) sehingga dapat dibagikan dan bekerja di server.
 * Pilihan langsung ditandai aktif saat diketuk (optimistis), tanpa menunggu data periode baru selesai dimuat.
 */
export function PeriodFilter({ basePath, period }: { basePath: string; period: Period }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activeKey, setActiveKey] = useOptimistic<PeriodKey>(period.key);
  const [customOpen, setCustomOpen] = useState(period.key === "custom");

  // Chip "Rentang khusus" menyala begitu diketuk (form terbuka) atau saat rentang khusus sedang dipakai.
  const customOn = customOpen || activeKey === "custom";

  function go(key: PeriodKey, href: string) {
    startTransition(() => {
      setActiveKey(key);
      router.push(href);
    });
  }

  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Filter periode" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map((key) => {
          const href = `${basePath}${buildQuery({ p: key === "month" ? undefined : key })}`;
          return (
            <Link
              key={key}
              href={href}
              aria-current={activeKey === key && !customOn ? "true" : undefined}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setCustomOpen(false);
                go(key, href);
              }}
              className={chipCls(activeKey === key && !customOn)}
            >
              {PERIOD_LABELS[key]}
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={customOpen}
          aria-current={customOn ? "true" : undefined}
          onClick={() => setCustomOpen((o) => !o)}
          className={cn(chipCls(customOn), "inline-flex items-center gap-1.5")}
        >
          {pending && activeKey === "custom" && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {period.key === "custom" ? period.label : PERIOD_LABELS.custom}
        </button>
      </div>

      {customOpen && (
        <form
          className="grid grid-cols-2 gap-2 sm:flex sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const from = String(fd.get("from") ?? "");
            const to = String(fd.get("to") ?? "");
            if (!from || !to) return;
            go("custom", `${basePath}${buildQuery({ p: "custom", from, to })}`);
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Dari
            <input type="date" name="from" required defaultValue={period.key === "custom" ? period.from : undefined} className={dateCls} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Sampai
            <input type="date" name="to" required defaultValue={period.key === "custom" ? period.to : undefined} className={dateCls} />
          </label>
          <Button type="submit" variant="outline" className="col-span-2 h-9 rounded-xl sm:col-span-1" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Terapkan
          </Button>
        </form>
      )}
    </div>
  );
}
