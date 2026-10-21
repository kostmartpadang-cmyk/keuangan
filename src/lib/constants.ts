import type { AccountKind, GoalStatus, PaymentMethod, TransactionType } from "./types";

export const APP_NAME = "RuangUang";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Tunai",
  qris_bank: "QRIS/Rekening",
};

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Pemasukan",
  expense: "Pengeluaran",
  transfer: "Transfer",
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: "Tunai",
  bank: "QRIS/Rekening",
  other: "Lainnya",
};

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Berjalan",
  achieved: "Tercapai",
  cancelled: "Dibatalkan",
};

/** Pilihan penghitungan anggaran untuk satu transaksi pengeluaran. */
export const COUNT_MODES = [
  { value: "both", label: "Mingguan & bulanan", weekly: true, monthly: true },
  { value: "weekly", label: "Mingguan saja", weekly: true, monthly: false },
  { value: "monthly", label: "Bulanan saja", weekly: false, monthly: true },
  { value: "none", label: "Tidak dihitung", weekly: false, monthly: false },
] as const;

export type CountMode = (typeof COUNT_MODES)[number]["value"];

export function countModeOf(weekly: boolean, monthly: boolean): CountMode {
  return COUNT_MODES.find((m) => m.weekly === weekly && m.monthly === monthly)!.value;
}

export const PAGE_SIZE = 20;

/** Ambang peringatan anggaran. */
export const BUDGET_WARN_RATIO = 0.8;
