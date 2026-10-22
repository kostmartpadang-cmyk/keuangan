import { addCycles, addDays, cycleEnd, cycleStart, weekEnd, weekStart, type ISODate } from "../dates";
import { BUDGET_WARN_RATIO } from "../constants";
import type { Budget, BudgetPeriodType, TransactionLite } from "../types";

/** `startDay` = tanggal mulai "bulan" (mis. tanggal gajian); hanya berpengaruh pada anggaran bulanan. */
/** `weekDay` = hari mulai minggu (1 = Senin … 7 = Minggu); hanya berpengaruh pada anggaran mingguan. */
export function periodStartOf(type: BudgetPeriodType, date: ISODate, startDay = 1, weekDay = 1): ISODate {
  return type === "weekly" ? weekStart(date, weekDay) : cycleStart(date, startDay);
}

export function periodEndOf(type: BudgetPeriodType, start: ISODate, startDay = 1, weekDay = 1): ISODate {
  return type === "weekly" ? weekEnd(start, weekDay) : cycleEnd(start, startDay);
}

export function previousPeriodStart(type: BudgetPeriodType, start: ISODate, startDay = 1): ISODate {
  return type === "weekly" ? addDays(start, -7) : addCycles(start, -1, startDay);
}

/**
 * Batas berlaku sejak `period_start` baris anggaran sampai ada baris lebih baru.
 * Mengembalikan 0 bila belum ada batas (atau dinonaktifkan dengan amount = 0).
 */
export function resolveLimit(
  budgets: Budget[],
  type: BudgetPeriodType,
  categoryId: string | null,
  periodStart: ISODate,
): number {
  let best: Budget | null = null;
  for (const b of budgets) {
    if (b.period_type !== type || b.category_id !== categoryId || b.period_start > periodStart) continue;
    if (!best || b.period_start > best.period_start) best = b;
  }
  return best?.amount ?? 0;
}

type SpendTx = Pick<TransactionLite, "type" | "amount" | "category_id" | "tx_date" | "count_weekly" | "count_monthly">;

/** Pengeluaran yang dihitung ke anggaran pada periode tertentu (hormati pilihan per transaksi). */
export function spentInPeriod(
  txs: SpendTx[],
  type: BudgetPeriodType,
  categoryId: string | null,
  start: ISODate,
  end: ISODate,
): number {
  let total = 0;
  for (const t of txs) {
    if (t.type !== "expense") continue;
    if (t.tx_date < start || t.tx_date > end) continue;
    if (type === "weekly" ? !t.count_weekly : !t.count_monthly) continue;
    if (categoryId !== null && t.category_id !== categoryId) continue;
    total += t.amount;
  }
  return total;
}

export type BudgetLevel = "none" | "ok" | "warning" | "over";

export interface BudgetStatus {
  limit: number;
  spent: number;
  remaining: number; // bisa negatif bila melewati batas
  ratio: number; // 0..∞
  level: BudgetLevel;
}

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return { limit: 0, spent, remaining: 0, ratio: 0, level: "none" };
  const ratio = spent / limit;
  const level: BudgetLevel = ratio >= 1 ? "over" : ratio >= BUDGET_WARN_RATIO ? "warning" : "ok";
  return { limit, spent, remaining: limit - spent, ratio, level };
}

export interface BudgetHistoryRow {
  start: ISODate;
  end: ISODate;
  status: BudgetStatus;
}

/** Riwayat anggaran total untuk `count` periode sebelum periode berjalan. */
export function budgetHistory(
  budgets: Budget[],
  txs: SpendTx[],
  type: BudgetPeriodType,
  today: ISODate,
  count: number,
  startDay = 1,
  weekDay = 1,
): BudgetHistoryRow[] {
  const rows: BudgetHistoryRow[] = [];
  let start = previousPeriodStart(type, periodStartOf(type, today, startDay, weekDay), startDay);
  for (let i = 0; i < count; i++) {
    const end = periodEndOf(type, start, startDay, weekDay);
    const limit = resolveLimit(budgets, type, null, start);
    rows.push({ start, end, status: budgetStatus(spentInPeriod(txs, type, null, start, end), limit) });
    start = previousPeriodStart(type, start, startDay);
  }
  return rows;
}

export interface CategoryBudgetStatus extends BudgetStatus {
  category_id: string;
  name: string;
}

export interface BudgetOverview {
  type: BudgetPeriodType;
  start: ISODate;
  end: ISODate;
  total: BudgetStatus;
  categories: CategoryBudgetStatus[];
}

/** Status anggaran total dan per kategori untuk periode berjalan. Kategori tanpa batas tidak disertakan. */
export function currentBudgetOverview(
  budgets: Budget[],
  txs: SpendTx[],
  expenseCategories: { id: string; name: string }[],
  type: BudgetPeriodType,
  today: ISODate,
  startDay = 1,
  weekDay = 1,
): BudgetOverview {
  const start = periodStartOf(type, today, startDay, weekDay);
  const end = periodEndOf(type, start, startDay, weekDay);
  const total = budgetStatus(spentInPeriod(txs, type, null, start, end), resolveLimit(budgets, type, null, start));
  const categories: CategoryBudgetStatus[] = [];
  for (const c of expenseCategories) {
    const limit = resolveLimit(budgets, type, c.id, start);
    if (limit <= 0) continue;
    categories.push({
      category_id: c.id,
      name: c.name,
      ...budgetStatus(spentInPeriod(txs, type, c.id, start, end), limit),
    });
  }
  categories.sort((a, b) => b.ratio - a.ratio);
  return { type, start, end, total, categories };
}
