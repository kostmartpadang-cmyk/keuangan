import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PlanEditor, type PlanItemView } from "@/components/planning/plan-editor";
import { Money, PageHeader, SectionCard } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/auth";
import { getAccounts, getCategories, getPlan, hasPlan, getTransactionsInRange } from "@/lib/data/queries";
import { addMonths, formatMonthYear, isValidISODate, monthEnd, monthStart, todayJakarta } from "@/lib/dates";
import { expenseByCategory, totalsOf } from "@/lib/finance/aggregate";
import { summarizePlan } from "@/lib/finance/plan";
import { first } from "@/lib/url";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Perencanaan" };

export default async function PlanningPage({ searchParams }: PageProps<"/planning">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const raw = first(sp.month);
  const month = monthStart(raw && isValidISODate(`${raw}-01`) ? `${raw}-01` : todayJakarta());
  const monthParam = (m: string) => `/planning?month=${m.slice(0, 7)}`;

  const [{ plan, items }, prevExists, accounts, categories, txs] = await Promise.all([
    getPlan(supabase, month),
    hasPlan(supabase, addMonths(month, -1)),
    getAccounts(supabase),
    getCategories(supabase),
    getTransactionsInRange(supabase, month, monthEnd(month)),
  ]);

  // Gaji disinkronkan dengan transaksi pemasukan kategori "Gaji" pada bulan ini; perkiraan manual hanya cadangan.
  const salaryCategory = categories.find((c) => c.type === "income" && c.name.trim().toLowerCase() === "gaji");
  const recordedSalary = salaryCategory
    ? txs.filter((t) => t.type === "income" && t.category_id === salaryCategory.id).reduce((s, t) => s + t.amount, 0)
    : 0;
  const manualSalary = plan?.salary ?? 0;
  const salary = recordedSalary > 0 ? recordedSalary : manualSalary;
  const salaryFromTransactions = recordedSalary > 0;
  const summary = summarizePlan(salary, items);
  const actualByCategory = new Map(expenseByCategory(txs).map((c) => [c.category_id, c.total]));
  const actualTotal = totalsOf(txs).expense;
  const realBalance = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + a.balance, 0);
  const expenseCats = categories.filter((c) => c.type === "expense");

  const views: PlanItemView[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    kind: i.kind,
    category_id: i.category_id,
    amount: i.amount,
    actual: i.category_id ? (actualByCategory.get(i.category_id) ?? 0) : null,
  }));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Perencanaan"
        description="Bagi gaji menjadi pos-pos. Rencana bukan saldo: sisa dana yang belum dialokasikan tidak sama dengan uang di rekening."
      />

      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-2">
        <Button render={<Link href={monthParam(addMonths(month, -1))} />} nativeButton={false} variant="ghost" size="icon" aria-label="Bulan sebelumnya">
          <ChevronLeft aria-hidden />
        </Button>
        <p className="font-semibold">{formatMonthYear(month)}</p>
        <Button render={<Link href={monthParam(addMonths(month, 1))} />} nativeButton={false} variant="ghost" size="icon" aria-label="Bulan berikutnya">
          <ChevronRight aria-hidden />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard title="Rencana" description="Dari gaji dan pos yang Anda tetapkan">
          <dl className="grid gap-2 text-sm">
            <Row label={salaryFromTransactions ? "Gaji (dari transaksi)" : "Gaji (perkiraan manual)"} value={summary.salary} />
            <Row label="Biaya tetap" value={-summary.fixedTotal} />
            <Row label="Total anggaran" value={-summary.budgetTotal} />
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t pt-3">
              <dt className="font-semibold">Belum dialokasikan</dt>
              <dd className={cn("tabular text-lg font-bold", summary.unallocated < 0 ? "text-expense" : "text-income")}>
                <Money value={summary.unallocated} />
              </dd>
            </div>
          </dl>
          {summary.unallocated < 0 && (
            <p role="alert" className="mt-3 rounded-xl bg-expense-soft px-3 py-2 text-xs text-expense">
              Total rencana melebihi gaji sebesar <Money value={-summary.unallocated} />. Kurangi beberapa pos.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">Gaji − (biaya tetap + anggaran) = dana yang belum dialokasikan.</p>
        </SectionCard>

        <SectionCard title="Kenyataan" description="Dari transaksi yang tercatat">
          <dl className="grid gap-2 text-sm">
            <Row label="Uang tersedia saat ini (saldo akun)" value={realBalance} />
            <Row label={`Pengeluaran aktual ${formatMonthYear(month)}`} value={actualTotal} />
            <Row label="Rencana pengeluaran (biaya tetap + anggaran)" value={summary.plannedTotal} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Saldo akun berasal dari saldo awal dan transaksi, bukan dari rencana di sini.
          </p>
        </SectionCard>
      </div>

      <PlanEditor
        month={month}
        salary={manualSalary}
        recordedSalary={recordedSalary}
        items={views}
        categories={expenseCats}
        canCopyPrevious={prevExists}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold">
        <Money value={value} />
      </dd>
    </div>
  );
}
