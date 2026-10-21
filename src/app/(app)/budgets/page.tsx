import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { SetBudgetButton } from "@/components/budgets/set-budget-button";
import { Money, PageHeader, ProgressBar, SectionCard } from "@/components/shared/ui-bits";
import { BUDGET_WARN_RATIO } from "@/lib/constants";
import { requireUser } from "@/lib/data/auth";
import { getBudgets, getCategories, getTransactionsInRange } from "@/lib/data/queries";
import { addDays, addMonths, formatDayMonth, formatMonthYear, formatRange, monthStart, todayJakarta, weekStart } from "@/lib/dates";
import {
  budgetHistory,
  budgetStatus,
  periodEndOf,
  periodStartOf,
  resolveLimit,
  spentInPeriod,
  type BudgetLevel,
} from "@/lib/finance/budgets";
import type { BudgetPeriodType } from "@/lib/types";
import { first } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Anggaran" };

const HISTORY_COUNT = { weekly: 8, monthly: 6 } as const;

const LEVEL_TEXT: Record<BudgetLevel, string> = {
  none: "Tanpa batas",
  ok: "Aman",
  warning: "Hampir habis",
  over: "Terlampaui",
};
const LEVEL_CLS: Record<BudgetLevel, string> = {
  none: "text-muted-foreground",
  ok: "text-income",
  warning: "text-warning",
  over: "text-expense",
};

export default async function BudgetsPage({ searchParams }: PageProps<"/budgets">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const type: BudgetPeriodType = first(sp.tab) === "monthly" ? "monthly" : "weekly";
  const today = todayJakarta();

  // Cukup mengambil transaksi mulai dari riwayat tertua yang ditampilkan.
  const historyFrom =
    type === "weekly"
      ? addDays(weekStart(today), -7 * HISTORY_COUNT.weekly)
      : monthStart(addMonths(today, -HISTORY_COUNT.monthly));

  const [categories, budgets, txs] = await Promise.all([
    getCategories(supabase),
    getBudgets(supabase),
    getTransactionsInRange(supabase, historyFrom, today),
  ]);

  const start = periodStartOf(type, today);
  const end = periodEndOf(type, start);
  const periodLabel = type === "weekly" ? formatRange(start, end) : formatMonthYear(start);
  const total = budgetStatus(spentInPeriod(txs, type, null, start, end), resolveLimit(budgets, type, null, start));
  const expenseCats = categories.filter((c) => c.type === "expense");
  const rows = expenseCats.map((c) => ({
    category: c,
    status: budgetStatus(spentInPeriod(txs, type, c.id, start, end), resolveLimit(budgets, type, c.id, start)),
    spent: spentInPeriod(txs, type, c.id, start, end),
  }));
  const history = budgetHistory(budgets, txs, type, today, HISTORY_COUNT[type]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Anggaran"
        description="Batasi pengeluaran per minggu (Senin–Minggu) atau per bulan kalender."
      />

      <div role="tablist" aria-label="Jenis anggaran" className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:w-80">
        {(["weekly", "monthly"] as const).map((t) => (
          <Link
            key={t}
            role="tab"
            aria-selected={type === t}
            href={t === "weekly" ? "/budgets" : "/budgets?tab=monthly"}
            className={cn(
              "rounded-xl py-2 text-center text-sm font-semibold transition-colors",
              type === t ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {t === "weekly" ? "Mingguan" : "Bulanan"}
          </Link>
        ))}
      </div>

      <SectionCard
        title={`Total ${type === "weekly" ? "minggu ini" : "bulan ini"}`}
        description={periodLabel}
        actions={<SetBudgetButton periodType={type} categoryId={null} title="Total" currentLimit={total.limit} variant="outline" />}
      >
        {total.level === "none" ? (
          <div className="grid gap-1">
            <p className="text-sm text-muted-foreground">
              Belum ada batas total. Terpakai <Money value={total.spent} className="font-semibold text-foreground" /> pada periode ini.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Batas</p>
                <Money value={total.limit} className="font-bold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Terpakai</p>
                <Money value={total.spent} className="font-bold" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{total.remaining < 0 ? "Lebih" : "Sisa"}</p>
                <Money value={Math.abs(total.remaining)} className={cn("font-bold", total.remaining < 0 ? "text-expense" : "text-income")} />
              </div>
            </div>
            <ProgressBar ratio={total.ratio} level={total.level} label={`Anggaran total: ${Math.round(total.ratio * 100)}% terpakai`} className="h-3" />
            <p className="text-xs text-muted-foreground">{Math.round(total.ratio * 100)}% terpakai</p>
            {total.level === "warning" && (
              <p role="status" className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle className="size-4 shrink-0" aria-hidden /> Sudah mencapai {Math.round(BUDGET_WARN_RATIO * 100)}% — anggaran hampir habis.
              </p>
            )}
            {total.level === "over" && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">
                <OctagonAlert className="size-4 shrink-0" aria-hidden /> Anggaran sudah terlampaui. Tinjau pengeluaran periode ini.
              </p>
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Per kategori" description="Hanya pengeluaran yang ditandai dihitung ke anggaran periode ini.">
        <ul className="divide-y">
          {rows.map(({ category, status, spent }) => (
            <li key={category.id} className="grid gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{category.name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {status.level === "none" ? (
                      <>
                        Terpakai <Money value={spent} />
                      </>
                    ) : (
                      <>
                        <Money value={status.spent} /> dari <Money value={status.limit} /> ·{" "}
                        <span className={cn("font-semibold", LEVEL_CLS[status.level])}>
                          {status.remaining < 0 ? "lebih " : "sisa "}
                          <Money value={Math.abs(status.remaining)} />
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <SetBudgetButton periodType={type} categoryId={category.id} title={category.name} currentLimit={status.limit} />
              </div>
              {status.level !== "none" && (
                <ProgressBar ratio={status.ratio} level={status.level} label={`${category.name}: ${Math.round(status.ratio * 100)}% terpakai`} className="h-1.5" />
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Riwayat anggaran" description={`${HISTORY_COUNT[type]} ${type === "weekly" ? "minggu" : "bulan"} sebelumnya (anggaran total)`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="pb-2 font-medium">Periode</th>
                <th scope="col" className="pb-2 text-right font-medium">Batas</th>
                <th scope="col" className="pb-2 text-right font-medium">Terpakai</th>
                <th scope="col" className="pb-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {history.map((h) => (
                <tr key={h.start}>
                  <td className="py-2.5">{type === "weekly" ? `${formatDayMonth(h.start)} – ${formatDayMonth(h.end)}` : formatMonthYear(h.start)}</td>
                  <td className="py-2.5 text-right">{h.status.limit > 0 ? <Money value={h.status.limit} /> : "—"}</td>
                  <td className="py-2.5 text-right">
                    <Money value={h.status.spent} />
                  </td>
                  <td className={cn("py-2.5 text-right text-xs font-semibold", LEVEL_CLS[h.status.level])}>
                    {LEVEL_TEXT[h.status.level]}
                    {h.status.level !== "none" && ` (${Math.round(h.status.ratio * 100)}%)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
