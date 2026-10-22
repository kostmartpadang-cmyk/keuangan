import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, PiggyBank, Plus, ReceiptText, Wallet } from "lucide-react";
import { BudgetProgressCard, InsightList } from "@/components/dashboard/widgets";
import { WeeklyBudgetAlert } from "@/components/dashboard/weekly-budget-alert";
import { CategoryBreakdown, IncomeExpenseChart } from "@/components/charts/charts";
import { EmptyState, Money, PageHeader, SectionCard, StatCard } from "@/components/shared/ui-bits";
import { PeriodFilter } from "@/components/shared/period-filter";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/data/auth";
import {
  getAccounts,
  getBudgets,
  getCategories,
  getRecentTransactions,
  getTransactionsInRange,
} from "@/lib/data/queries";
import { addMonths, formatRange, monthStart, periodFromSearchParams, todayJakarta } from "@/lib/dates";
import { expenseByCategory, incomeExpenseSeries, totalsOf } from "@/lib/finance/aggregate";
import { currentBudgetOverview } from "@/lib/finance/budgets";
import { buildInsights } from "@/lib/finance/insights";
import { formatRupiah } from "@/lib/money";
import { ACCOUNT_KIND_LABELS, BUDGET_LOW_REMAINING_RATIO } from "@/lib/constants";

export const metadata: Metadata = { title: "Beranda" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const profile = await getProfile();

  const today = todayJakarta();
  const period = periodFromSearchParams(sp);
  // Anggaran & insight selalu memakai bulan lalu s.d. hari ini, terlepas dari filter periode.
  const wideFrom = monthStart(addMonths(today, -1));

  // Periode yang sudah tercakup rentang lebar (mis. bulan ini) disaring dari data yang sama, tanpa query tambahan.
  const periodInsideWide = period.from >= wideFrom && period.to <= today;

  const [accounts, categories, budgets, wideTxs, periodFetched, recent] = await Promise.all([
    getAccounts(supabase),
    getCategories(supabase),
    getBudgets(supabase),
    getTransactionsInRange(supabase, wideFrom, today),
    periodInsideWide ? Promise.resolve(null) : getTransactionsInRange(supabase, period.from, period.to),
    getRecentTransactions(supabase, 6),
  ]);
  const periodTxs = periodFetched ?? wideTxs.filter((t) => t.tx_date >= period.from && t.tx_date <= period.to);

  const activeAccounts = accounts.filter((a) => !a.is_archived);
  const totalBalance = activeAccounts.reduce((s, a) => s + a.balance, 0);
  const totals = totalsOf(periodTxs);
  const series = incomeExpenseSeries(periodTxs, period.from, period.to);

  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const slices = expenseByCategory(periodTxs).map((c) => ({
    id: c.category_id,
    name: catName.get(c.category_id) ?? "Tanpa kategori",
    total: c.total,
  }));

  const expenseCats = categories.filter((c) => c.type === "expense");
  const weekly = currentBudgetOverview(budgets, wideTxs, expenseCats, "weekly", today);
  const monthly = currentBudgetOverview(budgets, wideTxs, expenseCats, "monthly", today);
  const insights = buildInsights({ txs: wideTxs, budgets, categories, today });
  const reminders = insights.filter((i) => i.tone === "warning" || i.tone === "danger").filter((i) => i.id.startsWith("budget-"));
  const otherInsights = insights.filter((i) => !reminders.includes(i));

  const weeklyTotal = weekly.total;
  const weeklyLow =
    weeklyTotal.level === "warning" && weeklyTotal.remaining <= weeklyTotal.limit * BUDGET_LOW_REMAINING_RATIO
      ? `Sisa ${formatRupiah(weeklyTotal.remaining)} (${Math.round((weeklyTotal.remaining / weeklyTotal.limit) * 100)}%) dari batas minggu ini.`
      : null;

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const firstName = profile.full_name?.split(" ")[0];
  const noTransactionsEver = recent.length === 0;

  return (
    <div className="grid gap-5">
      {weeklyLow && <WeeklyBudgetAlert weekStart={weekly.start} message={weeklyLow} />}
      <PageHeader
        title={firstName ? `Halo, ${firstName}` : "Beranda"}
        description={`Ringkasan keuangan · ${formatRange(period.from, period.to)}`}
        actions={
          <Button render={<Link href="/transactions/new" />} nativeButton={false} className="hidden h-10 rounded-xl md:inline-flex">
            <Plus aria-hidden /> Tambah transaksi
          </Button>
        }
      />

      <PeriodFilter basePath="/dashboard" period={period} />

      {noTransactionsEver && (
        <EmptyState
          icon={ReceiptText}
          title="Mulai catat keuangan Anda"
          description="Belum ada transaksi. Tambahkan pemasukan atau pengeluaran pertama, lalu atur saldo awal akun di halaman Akun uang bila perlu."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button render={<Link href="/transactions/new" />} nativeButton={false} className="h-10 rounded-xl">
                <Plus aria-hidden /> Catat transaksi
              </Button>
              <Button render={<Link href="/accounts" />} nativeButton={false} variant="outline" className="h-10 rounded-xl">
                Atur saldo awal
              </Button>
            </div>
          }
        />
      )}

      {reminders.length > 0 && (
        <section aria-label="Pengingat anggaran" className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Pengingat</h2>
          <InsightList insights={reminders} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pemasukan" value={<Money value={totals.income} />} hint={period.label} icon={ArrowDownLeft} tone="income" />
        <StatCard label="Pengeluaran" value={<Money value={totals.expense} />} hint={period.label} icon={ArrowUpRight} tone="expense" />
        <StatCard
          label="Sisa uang"
          value={<Money value={totalBalance} tone="auto" />}
          hint="Total saldo semua akun berdasarkan transaksi tercatat"
          icon={Wallet}
        />
        <StatCard
          label="Anggaran bulan ini tersedia"
          value={monthly.total.level === "none" ? <span className="text-base font-semibold text-muted-foreground">Belum diatur</span> : <Money value={monthly.total.remaining} tone="auto" />}
          hint={
            monthly.total.level === "none" ? (
              <Link href="/budgets" className="font-medium text-primary hover:underline">
                Atur anggaran bulanan
              </Link>
            ) : (
              <>
                Terpakai <Money value={monthly.total.spent} /> dari <Money value={monthly.total.limit} />
              </>
            )
          }
          icon={PiggyBank}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <SectionCard title="Pemasukan & pengeluaran" description={period.label} className="lg:col-span-3">
          <IncomeExpenseChart data={series} />
        </SectionCard>
        <SectionCard title="Pengeluaran per kategori" description={period.label} className="lg:col-span-2">
          <CategoryBreakdown items={slices} />
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard
          title="Anggaran minggu ini"
          description="Senin – Minggu"
          actions={
            <Link href="/budgets" className="text-xs font-medium text-primary hover:underline">
              Kelola
            </Link>
          }
        >
          <BudgetProgressCard overview={weekly} title="Total minggu ini" showCategories={3} />
        </SectionCard>

        <SectionCard
          title="Saldo per akun"
          actions={
            <Link href="/accounts" className="text-xs font-medium text-primary hover:underline">
              Kelola
            </Link>
          }
        >
          {activeAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada akun aktif.</p>
          ) : (
            <ul className="grid gap-3">
              {activeAccounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABELS[a.kind]}</p>
                  </div>
                  <Money value={a.balance} tone="auto" className="text-sm font-bold" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {otherInsights.length > 0 && (
        <section aria-label="Insight" className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Insight bulan ini</h2>
          <InsightList insights={otherInsights} />
        </section>
      )}

      <SectionCard
        title="Transaksi terbaru"
        actions={
          <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">
            Lihat semua
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((tx) => (
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
