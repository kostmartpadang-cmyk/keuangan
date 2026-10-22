import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Scale } from "lucide-react";
import { CategoryBreakdown, CompareChart, ExpenseTrendChart } from "@/components/charts/charts";
import { InsightList } from "@/components/dashboard/widgets";
import { EmptyState, Money, PageHeader, SectionCard, StatCard } from "@/components/shared/ui-bits";
import { PeriodFilter } from "@/components/shared/period-filter";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/data/auth";
import { getAccounts, getBudgets, getCategories, getTransactionsInRange, getFullTransactionsInRange } from "@/lib/data/queries";
import {
  addCycles,
  addMonths,
  cycleEnd,
  cycleStart,
  formatCycle,
  formatRange,
  formatWeekSpan,
  monthStart,
  periodFromSearchParams,
  todayJakarta,
} from "@/lib/dates";
import { expenseByCategory, monthlyExpenseTrend, totalsOf, weeklyExpenseTrend } from "@/lib/finance/aggregate";
import { buildInsights } from "@/lib/finance/insights";
import { formatRupiah } from "@/lib/money";
import { buildQuery } from "@/lib/url";
import { ReceiptText } from "lucide-react";

export const metadata: Metadata = { title: "Laporan" };

const HISTORY_LIMIT = 100;

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const today = todayJakarta();
  const profile = await getProfile();
  const startDay = profile.month_start_day;
  const weekDay = profile.week_start_day;
  const period = periodFromSearchParams(sp, "month", startDay, weekDay);
  const trendFrom = monthStart(addMonths(today, -11));

  const [accounts, categories, budgets, periodTxs, trendTxs, history] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    getBudgets(supabase),
    getTransactionsInRange(supabase, period.from, period.to),
    getTransactionsInRange(supabase, trendFrom, today),
    getFullTransactionsInRange(supabase, period.from, period.to),
  ]);

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const totals = totalsOf(periodTxs);
  const byCategory = expenseByCategory(periodTxs);
  const slices = byCategory.map((c) => ({ id: c.category_id, name: catName.get(c.category_id) ?? "Tanpa kategori", total: c.total }));
  const top = byCategory[0];

  const weekly = weeklyExpenseTrend(trendTxs, today, 12, weekDay);
  const monthly = monthlyExpenseTrend(trendTxs, today, 12);

  // Perbandingan bulan ini vs bulan lalu per kategori (8 kategori teratas dari keduanya)
  const thisStart = cycleStart(today, startDay);
  const lastStart = addCycles(thisStart, -1, startDay);
  const thisMonth = expenseByCategory(trendTxs.filter((t) => t.tx_date >= thisStart));
  const lastMonth = expenseByCategory(trendTxs.filter((t) => t.tx_date >= lastStart && t.tx_date <= cycleEnd(lastStart, startDay)));
  const ids = new Set([...thisMonth, ...lastMonth].map((c) => c.category_id));
  const compare = [...ids]
    .map((id) => ({
      label: catName.get(id) ?? "Tanpa kategori",
      current: thisMonth.find((c) => c.category_id === id)?.total ?? 0,
      previous: lastMonth.find((c) => c.category_id === id)?.total ?? 0,
    }))
    .sort((a, b) => b.current + b.previous - (a.current + a.previous))
    .slice(0, 8);

  const insights = buildInsights({ txs: trendTxs.filter((t) => t.tx_date >= lastStart), budgets, categories, today, startDay, weekDay });
  const exportHref = `/api/export${buildQuery({ from: period.from, to: period.to })}`;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Laporan"
        description={`Berdasarkan transaksi tercatat · ${formatRange(period.from, period.to)}`}
        actions={
          <>
            <Button render={<a href={exportHref} download />} nativeButton={false} variant="outline" className="h-10 rounded-xl">
              <Download aria-hidden /> Ekspor CSV (periode ini)
            </Button>
            <Button render={<a href="/api/export" download />} nativeButton={false} variant="ghost" className="h-10 rounded-xl">
              Ekspor semua
            </Button>
          </>
        }
      />

      <PeriodFilter basePath="/reports" period={period} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Total pemasukan" value={<Money value={totals.income} />} icon={ArrowDownLeft} tone="income" hint={period.label} />
        <StatCard label="Total pengeluaran" value={<Money value={totals.expense} />} icon={ArrowUpRight} tone="expense" hint={period.label} />
        <StatCard
          className="col-span-2 lg:col-span-1"
          label="Selisih (pemasukan − pengeluaran)"
          value={<Money value={totals.net} tone="auto" signed />}
          icon={Scale}
          hint={
            top
              ? `Terbesar: ${catName.get(top.category_id) ?? "Tanpa kategori"} (${formatRupiah(top.total)})`
              : "Belum ada pengeluaran pada periode ini"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Pengeluaran per kategori" description={period.label}>
          <CategoryBreakdown items={slices} />
        </SectionCard>
        <SectionCard title="Perbandingan antarbulan" description={`${formatCycle(lastStart, startDay)} vs ${formatCycle(thisStart, startDay)} (8 kategori teratas)`}>
          <CompareChart data={compare} currentLabel={formatCycle(thisStart, startDay)} previousLabel={formatCycle(lastStart, startDay)} />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Tren pengeluaran mingguan" description={`12 minggu terakhir (${formatWeekSpan(weekDay)}, label = hari pertama minggu)`}>
          <ExpenseTrendChart data={weekly} caption="Pengeluaran mingguan" />
        </SectionCard>
        <SectionCard title="Tren pengeluaran bulanan" description="12 bulan terakhir">
          <ExpenseTrendChart data={monthly} caption="Pengeluaran bulanan" />
        </SectionCard>
      </div>

      {insights.length > 0 && (
        <section aria-label="Insight" className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Insight</h2>
          <InsightList insights={insights} />
        </section>
      )}

      <SectionCard
        title="Riwayat transaksi"
        description={history.length > HISTORY_LIMIT ? `Menampilkan ${HISTORY_LIMIT} terbaru dari ${history.length}. Ekspor CSV untuk data lengkap.` : `${history.length} transaksi`}
        actions={
          <Link href={`/transactions${buildQuery({ from: period.from, to: period.to })}`} className="text-xs font-medium text-primary hover:underline">
            Buka di Transaksi
          </Link>
        }
      >
        {history.length === 0 ? (
          <EmptyState icon={ReceiptText} title="Tidak ada transaksi" description="Tidak ada transaksi pada rentang tanggal ini." className="border-0 py-6" />
        ) : (
          <ul className="divide-y">
            {history.slice(0, HISTORY_LIMIT).map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categoryName={(tx.category_id && catName.get(tx.category_id)) || "Tanpa kategori"}
                accountNames={accountNames}
                actions={false}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
