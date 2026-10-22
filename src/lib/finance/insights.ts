import { addCycles, addDays, cycleEnd, cycleStart, daysBetween, formatDayMonth, type ISODate } from "../dates";
import { BUDGET_LOW_REMAINING_RATIO } from "../constants";
import { formatRupiah } from "../money";
import type { Category, TransactionLite } from "../types";
import { expenseByCategory, totalsOf } from "./aggregate";
import { budgetStatus, resolveLimit, spentInPeriod, periodEndOf, periodStartOf } from "./budgets";
import type { Budget } from "../types";

export interface Insight {
  id: string;
  tone: "info" | "warning" | "danger" | "good";
  title: string;
  detail?: string;
}

type Tx = Pick<
  TransactionLite,
  "type" | "amount" | "category_id" | "tx_date" | "count_weekly" | "count_monthly"
>;

/**
 * Insight sederhana yang seluruhnya dihitung dari data nyata.
 * `txs` harus mencakup minimal awal bulan lalu sampai hari ini.
 */
export function buildInsights(params: {
  txs: Tx[];
  budgets: Budget[];
  categories: Category[];
  today: ISODate;
  /** Tanggal mulai "bulan" (mis. gajian); bawaan 1. `txs` harus mencakup awal bulan sebelumnya. */
  startDay?: number;
}): Insight[] {
  const { txs, budgets, categories, today, startDay = 1 } = params;
  const nameOf = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Tanpa kategori";
  const out: Insight[] = [];

  const thisStart = cycleStart(today, startDay);
  const lastStart = addCycles(thisStart, -1, startDay);
  const dayOfMonth = daysBetween(thisStart, today); // 0-based
  const lastSameDay = [addDays(lastStart, dayOfMonth), cycleEnd(lastStart, startDay)].sort()[0];

  const thisMonth = txs.filter((t) => t.tx_date >= thisStart && t.tx_date <= today);
  const lastMonthSamePeriod = txs.filter((t) => t.tx_date >= lastStart && t.tx_date <= lastSameDay);

  // 1. Kategori terbesar bulan ini
  const cats = expenseByCategory(thisMonth);
  const totalExpense = totalsOf(thisMonth).expense;
  if (cats.length > 0 && totalExpense > 0) {
    const top = cats[0];
    const share = Math.round((top.total / totalExpense) * 100);
    out.push({
      id: "top-category",
      tone: "info",
      title: `Pengeluaran terbesar bulan ini: ${nameOf(top.category_id)}`,
      detail: `${formatRupiah(top.total)} (${share}% dari total pengeluaran ${formatRupiah(totalExpense)}).`,
    });
  }

  // 2. Perbandingan dengan periode yang sama bulan lalu
  const lastExpense = totalsOf(lastMonthSamePeriod).expense;
  if (lastExpense > 0 || totalExpense > 0) {
    const label = `${formatDayMonth(lastStart)} – ${formatDayMonth(lastSameDay)}`;
    if (lastExpense === 0) {
      out.push({
        id: "compare",
        tone: "info",
        title: "Belum ada pengeluaran di periode yang sama bulan lalu",
        detail: `Bulan ini sudah ${formatRupiah(totalExpense)}.`,
      });
    } else {
      const diff = totalExpense - lastExpense;
      const pct = Math.round((Math.abs(diff) / lastExpense) * 100);
      out.push({
        id: "compare",
        tone: diff > 0 ? "warning" : "good",
        title:
          diff === 0
            ? "Pengeluaran sama dengan periode yang sama bulan lalu"
            : `Pengeluaran ${diff > 0 ? "naik" : "turun"} ${pct}% dibanding periode yang sama bulan lalu`,
        detail: `Bulan ini ${formatRupiah(totalExpense)} vs ${formatRupiah(lastExpense)} (${label}).`,
      });
    }
  }

  // 3. Anggaran hampir habis / terlampaui
  for (const type of ["weekly", "monthly"] as const) {
    const start = periodStartOf(type, today, startDay);
    const end = periodEndOf(type, start, startDay);
    const periodName = type === "weekly" ? "mingguan" : "bulanan";

    const total = budgetStatus(
      spentInPeriod(txs, type, null, start, end),
      resolveLimit(budgets, type, null, start),
    );
    if (total.level === "warning" || total.level === "over") {
      const low = type === "weekly" && total.level === "warning" && total.remaining <= total.limit * BUDGET_LOW_REMAINING_RATIO;
      out.push({
        id: `budget-${type}-total`,
        tone: total.level === "over" ? "danger" : "warning",
        title:
          total.level === "over"
            ? `Anggaran ${periodName} total sudah terlampaui`
            : low
              ? `Sisa anggaran mingguan tinggal ${Math.max(0, Math.round((total.remaining / total.limit) * 100))}% (${formatRupiah(total.remaining)})`
              : `Anggaran ${periodName} total hampir habis (${Math.round(total.ratio * 100)}%)`,
        detail: `Terpakai ${formatRupiah(total.spent)} dari ${formatRupiah(total.limit)}.`,
      });
    }

    for (const c of categories.filter((c) => c.type === "expense")) {
      const s = budgetStatus(
        spentInPeriod(txs, type, c.id, start, end),
        resolveLimit(budgets, type, c.id, start),
      );
      if (s.level === "over") {
        out.push({
          id: `budget-${type}-${c.id}`,
          tone: "danger",
          title: `Kategori ${c.name} melewati anggaran ${periodName}`,
          detail: `Terpakai ${formatRupiah(s.spent)} dari ${formatRupiah(s.limit)}. Pertimbangkan meninjau kategori ini.`,
        });
      } else if (s.level === "warning") {
        out.push({
          id: `budget-${type}-${c.id}`,
          tone: "warning",
          title: `Kategori ${c.name} hampir mencapai anggaran ${periodName} (${Math.round(s.ratio * 100)}%)`,
          detail: `Sisa ${formatRupiah(s.remaining)}.`,
        });
      }
    }
  }

  return out;
}
