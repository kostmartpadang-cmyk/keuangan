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
