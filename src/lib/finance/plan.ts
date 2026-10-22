import type { PlanItem, PlanItemKind } from "../types";

/** Pos umum yang ditawarkan saat perencanaan masih kosong. `category` = nama kategori bawaan untuk membandingkan realisasi. */
export const PLAN_TEMPLATE: { name: string; kind: PlanItemKind; category: string | null }[] = [
  { name: "Kos", kind: "fixed", category: "Kos" },
  { name: "Listrik", kind: "fixed", category: "Listrik" },
  { name: "Pulsa dan paket data", kind: "fixed", category: "Pulsa dan paket data" },
  { name: "Makan", kind: "budget", category: "Makan" },
  { name: "Belanja bahan masak", kind: "budget", category: "Belanja bahan masak" },
  { name: "Transportasi", kind: "budget", category: "Transportasi" },
  { name: "Kebutuhan harian", kind: "budget", category: "Sabun dan kebutuhan harian" },
  { name: "Skincare dan perawatan diri", kind: "budget", category: "Skincare" },
  { name: "Hiburan", kind: "budget", category: "Hiburan" },
  { name: "Pembelian barang", kind: "budget", category: "Pakaian" },
  { name: "Hadiah atau traktiran", kind: "budget", category: "Hadiah untuk teman" },
];

/** Perkiraan porsi gaji per pos bila belum ada riwayat pengeluaran (pos tetap tidak ditebak). */
export const FALLBACK_SHARE: Record<string, number> = {
  Makan: 0.2,
  "Belanja bahan masak": 0.1,
  Transportasi: 0.07,
  "Kebutuhan harian": 0.03,
  "Skincare dan perawatan diri": 0.03,
  Hiburan: 0.05,
  "Pembelian barang": 0.05,
  "Hadiah atau traktiran": 0.02,
};

const ROUND_TO = 1000;

/**
 * Usulan nominal satu pos: rata-rata pengeluaran kategori pada bulan-bulan sebelumnya (dibulatkan ke ribuan);
 * bila belum ada riwayat, memakai porsi tetap dari gaji; bila keduanya tidak ada, 0.
 */
export function suggestAmount(params: { average: number; salary: number; fallbackShare?: number }): number {
  const { average, salary, fallbackShare } = params;
  const raw = average > 0 ? average : fallbackShare && salary > 0 ? salary * fallbackShare : 0;
  return Math.max(0, Math.round(raw / ROUND_TO) * ROUND_TO);
}

export interface PlanSummary {
  salary: number;
  fixedTotal: number;
  budgetTotal: number;
  plannedTotal: number;
  /** Gaji − (biaya tetap + anggaran). Negatif berarti rencana melebihi gaji. */
  unallocated: number;
}

export function summarizePlan(salary: number, items: Pick<PlanItem, "kind" | "amount">[]): PlanSummary {
  let fixedTotal = 0;
  let budgetTotal = 0;
  for (const i of items) {
    if (i.kind === "fixed") fixedTotal += i.amount;
    else budgetTotal += i.amount;
  }
  const plannedTotal = fixedTotal + budgetTotal;
  return { salary, fixedTotal, budgetTotal, plannedTotal, unallocated: salary - plannedTotal };
}
