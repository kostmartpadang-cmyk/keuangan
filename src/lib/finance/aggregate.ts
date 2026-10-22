import { addDays, addMonths, eachDay, formatDayMonth, formatMonthShort, monthStart, weekStart, type ISODate } from "../dates";
import type { TransactionLite } from "../types";

type Tx = Pick<TransactionLite, "type" | "amount" | "category_id" | "tx_date">;

export interface Totals {
  income: number;
  expense: number;
  net: number;
}

/** Transfer tidak pernah dihitung sebagai pemasukan/pengeluaran. */
export function totalsOf(txs: Tx[]): Totals {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") expense += t.amount;
  }
  return { income, expense, net: income - expense };
}

export interface CategoryTotal {
  category_id: string;
  total: number;
}

export function expenseByCategory(txs: Tx[]): CategoryTotal[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== "expense" || !t.category_id) continue;
    map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category_id, total]) => ({ category_id, total }))
    .sort((a, b) => b.total - a.total);
}

export interface SeriesPoint {
  key: string;
  label: string;
  income: number;
  expense: number;
}

/**
 * Deret pemasukan/pengeluaran. Rentang ≤ 62 hari dipecah per hari,
 * selebihnya per bulan agar grafik tetap terbaca.
 */
export function incomeExpenseSeries(txs: Tx[], from: ISODate, to: ISODate): SeriesPoint[] {
  const daily = eachDayCount(from, to) <= 62;
  const buckets = new Map<string, SeriesPoint>();

  if (daily) {
    for (const d of eachDay(from, to)) buckets.set(d, { key: d, label: formatDayMonth(d), income: 0, expense: 0 });
  } else {
    for (let m = monthStart(from); m <= to; m = addMonths(m, 1)) {
      buckets.set(m, { key: m, label: formatMonthShort(m), income: 0, expense: 0 });
    }
  }

  for (const t of txs) {
    if (t.type === "transfer") continue;
    const key = daily ? t.tx_date : monthStart(t.tx_date);
    const b = buckets.get(key);
    if (!b) continue;
    if (t.type === "income") b.income += t.amount;
    else b.expense += t.amount;
  }
  return [...buckets.values()];
}

function eachDayCount(from: ISODate, to: ISODate) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

export interface TrendPoint {
  key: string;
  label: string;
  expense: number;
}

/** Pengeluaran per minggu untuk n minggu terakhir, termasuk minggu berjalan (minggu dimulai pada `weekDay`, 1 = Senin). */
export function weeklyExpenseTrend(txs: Tx[], today: ISODate, n: number, weekDay = 1): TrendPoint[] {
  const first = addDays(weekStart(today, weekDay), -7 * (n - 1));
  const buckets = new Map<string, TrendPoint>();
  for (let i = 0; i < n; i++) {
    const k = addDays(first, 7 * i);
    buckets.set(k, { key: k, label: formatDayMonth(k), expense: 0 });
  }
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const b = buckets.get(weekStart(t.tx_date, weekDay));
    if (b) b.expense += t.amount;
  }
  return [...buckets.values()];
}

/** Pengeluaran per bulan kalender untuk n bulan terakhir, termasuk bulan berjalan. */
export function monthlyExpenseTrend(txs: Tx[], today: ISODate, n: number): TrendPoint[] {
  const first = addMonths(today, -(n - 1));
  const buckets = new Map<string, TrendPoint>();
  for (let i = 0; i < n; i++) {
    const k = addMonths(first, i);
    buckets.set(k, { key: k, label: formatMonthShort(k), expense: 0 });
  }
  for (const t of txs) {
    if (t.type !== "expense") continue;
    const b = buckets.get(monthStart(t.tx_date));
    if (b) b.expense += t.amount;
  }
  return [...buckets.values()];
}
