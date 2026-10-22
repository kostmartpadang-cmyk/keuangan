import Form from "next/form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PERIOD_LABELS, type Period, type PeriodKey } from "@/lib/dates";
import { buildQuery } from "@/lib/url";
import { cn } from "@/lib/utils";

const PRESETS: PeriodKey[] = ["today", "week", "month", "last_month"];

const dateCls =
  "min-w-0 max-w-full appearance-none h-9 w-full rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

/** Filter periode berbasis URL (?p=&from=&to=) sehingga dapat dibagikan dan bekerja di server. */
export function PeriodFilter({ basePath, period }: { basePath: string; period: Period }) {
  return (
    <div className="grid gap-2">
      <div role="group" aria-label="Filter periode" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {PRESETS.map((key) => (
          <Link
            key={key}
            href={`${basePath}${buildQuery({ p: key === "month" ? undefined : key })}`}
            aria-current={period.key === key ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              period.key === key ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {PERIOD_LABELS[key]}
          </Link>
        ))}
      </div>
      <details open={period.key === "custom"}>
        <summary
          className={cn(
            "inline-flex cursor-pointer list-none items-center rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors [&::-webkit-details-marker]:hidden",
            period.key === "custom" ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {period.key === "custom" ? period.label : PERIOD_LABELS.custom}
        </summary>
        <Form action={basePath} className="mt-1 grid grid-cols-2 gap-2 sm:flex sm:items-end">
          <input type="hidden" name="p" value="custom" />
          <label className="grid gap-1 text-xs text-muted-foreground">
            Dari
            <input type="date" name="from" required defaultValue={period.key === "custom" ? period.from : undefined} className={dateCls} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Sampai
            <input type="date" name="to" required defaultValue={period.key === "custom" ? period.to : undefined} className={dateCls} />
          </label>
          <Button type="submit" variant="outline" className="col-span-2 h-9 rounded-xl sm:col-span-1">
            Terapkan
          </Button>
        </Form>
      </details>
    </div>
  );
}
