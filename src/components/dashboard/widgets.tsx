import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { Money, ProgressBar } from "@/components/shared/ui-bits";
import { formatDayMonth } from "@/lib/dates";
import type { BudgetOverview } from "@/lib/finance/budgets";
import type { Insight } from "@/lib/finance/insights";
import { cn } from "@/lib/utils";

const TONE = {
  info: { Icon: Info, cls: "bg-muted text-foreground" },
  good: { Icon: CheckCircle2, cls: "bg-income-soft text-income" },
  warning: { Icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  danger: { Icon: OctagonAlert, cls: "bg-expense-soft text-expense" },
} as const;

export function InsightList({ insights, className }: { insights: Insight[]; className?: string }) {
  if (insights.length === 0) return null;
  return (
    <ul className={cn("grid gap-2", className)}>
      {insights.map((i) => {
        const { Icon, cls } = TONE[i.tone];
        return (
          <li key={i.id} className="flex gap-3 rounded-2xl border bg-card p-3.5">
            <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl", cls)}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{i.title}</p>
              {i.detail && <p className="mt-0.5 text-xs text-muted-foreground">{i.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function BudgetProgressCard({
  overview,
  title,
  showCategories = 0,
}: {
  overview: BudgetOverview;
  title: string;
  showCategories?: number;
}) {
  const { total, start, end } = overview;
  const period = `${formatDayMonth(start)} – ${formatDayMonth(end)}`;

  if (total.level === "none" && overview.categories.length === 0) {
    return (
      <div className="grid gap-1 text-sm">
        <p className="text-muted-foreground">
          Belum ada batas {overview.type === "weekly" ? "mingguan" : "bulanan"} untuk periode {period}.
        </p>
        <Link href="/budgets" className="font-semibold text-primary hover:underline">
          Atur anggaran
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {total.level !== "none" ? (
        <div className="grid gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{period}</p>
          </div>
          <ProgressBar ratio={total.ratio} level={total.level} label={`${title}: ${Math.round(total.ratio * 100)}% terpakai`} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className="text-muted-foreground">
              Terpakai <Money value={total.spent} className="font-semibold text-foreground" /> dari <Money value={total.limit} />
            </span>
            <span className={cn("font-semibold", total.remaining < 0 ? "text-expense" : "text-income")}>
              {total.remaining < 0 ? "Lebih " : "Sisa "}
              <Money value={Math.abs(total.remaining)} />
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Belum ada batas total untuk periode {period}. Terpakai <Money value={total.spent} />.
        </p>
      )}
      {showCategories > 0 &&
        overview.categories.slice(0, showCategories).map((c) => (
          <div key={c.category_id} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium">{c.name}</span>
              <span className="tabular text-muted-foreground">{Math.round(c.ratio * 100)}%</span>
            </div>
            <ProgressBar ratio={c.ratio} level={c.level} label={`${c.name}: ${Math.round(c.ratio * 100)}% terpakai`} className="h-1.5" />
          </div>
        ))}
    </div>
  );
}
