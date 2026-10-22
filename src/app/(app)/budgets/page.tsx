import type { Metadata } from "next";
import { AlertTriangle, OctagonAlert } from "lucide-react";
import { BudgetTabs } from "@/components/budgets/budget-tabs";
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
import type { Budget, BudgetPeriodType, Category, TransactionLite } from "@/lib/types";
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
  const initial: BudgetPeriodType = first(sp.tab) === "monthly" ? "monthly" : "weekly";
  const today = todayJakarta();

  // Satu pengambilan data untuk kedua tab (mulai dari riwayat tertua), agar pindah tab tidak perlu ke server.
  const historyFrom = [historyFromOf("weekly", today), historyFromOf("monthly", today)].sort()[0];

  const [categories, budgets, txs] = await Promise.all([
    getCategories(supabase),
    getBudgets(supabase),
    getTransactionsInRange(supabase, historyFrom, today),
  ]);
  const expenseCats = categories.filter((c) => c.type === "expense");
  const data = { today, txs, budgets, expenseCats };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Anggaran"
        description="Batasi pengeluaran per minggu (Senin–Minggu) atau per bulan kalender."
      />
      <BudgetTabs
        initial={initial}
        panels={{ weekly: <BudgetPanel type="weekly" {...data} />, monthly: <BudgetPanel type="monthly" {...data} /> }}
      />
    </div>
  );
}

function historyFromOf(type: BudgetPeriodType, today: string) {
  return type === "weekly"
    ? addDays(weekStart(today), -7 * HISTORY_COUNT.weekly)
    : monthStart(addMonths(today, -HISTORY_COUNT.monthly));
}

function BudgetPanel({
  type,
  today,
  txs,
  budgets,
  expenseCats,
}: {
  type: BudgetPeriodType;
  today: string;
  txs: TransactionLite[];
  budgets: Budget[];
  expenseCats: Category[];
}) {
  const start = periodStartOf(type, today);
  const end = periodEndOf(type, start);
  const periodLabel = type === "weekly" ? formatRange(start, end) : formatMonthYear(start);
  const total = budgetStatus(spentInPeriod(txs, type, null, start, end), resolveLimit(budgets, type, null, start));
  const rows = expenseCats.map((c) => ({
    category: c,
    status: budgetStatus(spentInPeriod(txs, type, c.id, start, end), resolveLimit(budgets, type, c.id, start)),
    spent: spentInPeriod(txs, type, c.id, start, end),
  }));
  const history = budgetHistory(budgets, txs, type, today, HISTORY_COUNT[type]);

  return (
    <>
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
            <dl className="grid gap-2 text-sm sm:grid-cols-3 sm:gap-4">
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs text-muted-foreground">Batas</dt>
                <dd>
                  <Money value={total.limit} className="text-base font-bold sm:text-lg" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs text-muted-foreground">Terpakai</dt>
                <dd>
                  <Money value={total.spent} className="text-base font-bold sm:text-lg" />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-xs text-muted-foreground">{total.remaining < 0 ? "Lebih" : "Sisa"}</dt>
                <dd>
                  <Money
                    value={Math.abs(total.remaining)}
                    className={cn("text-base font-bold sm:text-lg", total.remaining < 0 ? "text-expense" : "text-income")}
                  />
                </dd>
              </div>
            </dl>
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
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{category.name}</p>
                {status.level !== "none" && (
                  <span className={cn("tabular shrink-0 text-xs font-semibold", LEVEL_CLS[status.level])}>
                    {Math.round(status.ratio * 100)}%
                  </span>
                )}
                <SetBudgetButton periodType={type} categoryId={category.id} title={category.name} currentLimit={status.limit} />
              </div>
              {status.level !== "none" ? (
                <>
                  <ProgressBar ratio={status.ratio} level={status.level} label={`${category.name}: ${Math.round(status.ratio * 100)}% terpakai`} className="h-1.5" />
                  <div className="tabular flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                    <span>
                      <Money value={status.spent} /> dari <Money value={status.limit} />
                    </span>
                    <span className={cn("font-semibold", LEVEL_CLS[status.level])}>
                      {status.remaining < 0 ? "Lebih " : "Sisa "}
                      <Money value={Math.abs(status.remaining)} />
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada batas · terpakai <Money value={spent} />
                </p>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Riwayat anggaran" description={`${HISTORY_COUNT[type]} ${type === "weekly" ? "minggu" : "bulan"} sebelumnya (anggaran total)`}>
        <ul className="divide-y md:hidden">
          {history.map((h) => (
            <li key={h.start} className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  {type === "weekly" ? `${formatDayMonth(h.start)} – ${formatDayMonth(h.end)}` : formatMonthYear(h.start)}
                </p>
                <p className={cn("text-xs font-semibold", LEVEL_CLS[h.status.level])}>
                  {LEVEL_TEXT[h.status.level]}
                  {h.status.level !== "none" && ` (${Math.round(h.status.ratio * 100)}%)`}
                </p>
              </div>
              {h.status.level !== "none" && (
                <ProgressBar ratio={h.status.ratio} level={h.status.level} label={`${Math.round(h.status.ratio * 100)}% terpakai`} className="h-1.5" />
              )}
              <p className="tabular text-xs text-muted-foreground">
                Terpakai <Money value={h.status.spent} />
                {h.status.limit > 0 ? (
                  <>
                    {" "}
                    dari <Money value={h.status.limit} />
                  </>
                ) : (
                  " · tanpa batas"
                )}
              </p>
            </li>
          ))}
        </ul>

        <table className="hidden w-full text-sm md:table">
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
      </SectionCard>
    </>
  );
}
