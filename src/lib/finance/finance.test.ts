import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../csv";
import { addMonths, formatDate, monthEnd, resolvePeriod, todayJakarta, weekEnd, weekStart } from "../dates";
import { formatRupiah, parseRupiah } from "../money";
import type { Budget, Category, TransactionLite } from "../types";
import { expenseByCategory, incomeExpenseSeries, monthlyExpenseTrend, totalsOf, weeklyExpenseTrend } from "./aggregate";
import { budgetHistory, budgetStatus, resolveLimit, spentInPeriod } from "./budgets";
import { buildInsights } from "./insights";
import { summarizePlan } from "./plan";
import { transactionSchema } from "../validation";

let n = 0;
const tx = (p: Partial<TransactionLite> & Pick<TransactionLite, "type" | "amount" | "tx_date">): TransactionLite => ({
  id: String(++n),
  category_id: null,
  account_id: "a1",
  to_account_id: null,
  count_weekly: true,
  count_monthly: true,
  ...p,
});

describe("uang & tanggal", () => {
  it("memformat Rupiah", () => {
    expect(formatRupiah(3182955)).toBe("Rp3.182.955");
    expect(formatRupiah(0)).toBe("Rp0");
    expect(formatRupiah(-1500)).toBe("-Rp1.500");
    expect(parseRupiah("Rp 1.250.000")).toBe(1250000);
    expect(parseRupiah("")).toBe(0);
  });

  it("memformat tanggal Indonesia", () => {
    expect(formatDate("2026-10-21")).toBe("21 Okt 2026");
    expect(formatDate("2026-05-03")).toBe("3 Mei 2026");
  });

  it("minggu Senin–Minggu", () => {
    // 21 Okt 2026 = Rabu
    expect(weekStart("2026-10-21")).toBe("2026-10-19");
    expect(weekEnd("2026-10-21")).toBe("2026-10-25");
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // Minggu masih minggu yang sama
    expect(weekStart("2026-10-26")).toBe("2026-10-26"); // Senin memulai minggu baru
  });

  it("bulan kalender", () => {
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(monthEnd("2028-02-10")).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-01");
  });

  it("zona waktu Jakarta menggeser hari", () => {
    // 18:00 UTC tanggal 20 = 01:00 WIB tanggal 21
    expect(todayJakarta(new Date("2026-10-20T18:00:00Z"))).toBe("2026-10-21");
    expect(todayJakarta(new Date("2026-10-20T16:59:00Z"))).toBe("2026-10-20");
  });

  it("memutuskan periode", () => {
    const today = "2026-10-21";
    expect(resolvePeriod("month", {}, today)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolvePeriod("last_month", {}, today)).toMatchObject({ from: "2026-09-01", to: "2026-09-30" });
    expect(resolvePeriod("week", {}, today)).toMatchObject({ from: "2026-10-19", to: "2026-10-25" });
    expect(resolvePeriod("today", {}, today)).toMatchObject({ from: today, to: today });
    expect(resolvePeriod("custom", { from: "2026-10-10", to: "2026-10-05" }, today)).toMatchObject({ from: "2026-10-05", to: "2026-10-10" });
    expect(resolvePeriod("custom", { from: "bukan-tanggal" }, today).key).toBe("month");
  });
});

describe("agregasi", () => {
  const txs = [
    tx({ type: "income", amount: 1000, tx_date: "2026-10-01" }),
    tx({ type: "expense", amount: 300, tx_date: "2026-10-02", category_id: "makan" }),
    tx({ type: "expense", amount: 200, tx_date: "2026-10-03", category_id: "kos" }),
    tx({ type: "transfer", amount: 999, tx_date: "2026-10-03", to_account_id: "a2" }),
  ];

  it("transfer tidak dihitung sebagai pemasukan/pengeluaran", () => {
    expect(totalsOf(txs)).toEqual({ income: 1000, expense: 500, net: 500 });
  });

  it("pengeluaran per kategori terurut", () => {
    expect(expenseByCategory(txs)).toEqual([
      { category_id: "makan", total: 300 },
      { category_id: "kos", total: 200 },
    ]);
  });

  it("deret harian mengabaikan transfer", () => {
    const s = incomeExpenseSeries(txs, "2026-10-01", "2026-10-05");
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ income: 1000, expense: 0 });
    expect(s[2]).toMatchObject({ expense: 200 });
  });

  it("rentang panjang dikelompokkan per bulan", () => {
    const s = incomeExpenseSeries(txs, "2026-01-01", "2026-12-31");
    expect(s).toHaveLength(12);
    expect(s[9]).toMatchObject({ income: 1000, expense: 500 });
  });

  it("tren mingguan & bulanan", () => {
    const w = weeklyExpenseTrend(txs, "2026-10-21", 4);
    expect(w).toHaveLength(4);
    expect(w.map((x) => x.key)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
    expect(w[0].expense).toBe(500); // 2 & 3 Okt jatuh di minggu yang dimulai Senin 28 Sep
    expect(w[3].expense).toBe(0);
  });

  it("tren bulanan", () => {
    const m = monthlyExpenseTrend(txs, "2026-10-21", 3);
    expect(m.map((x) => x.key)).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]);
    expect(m[2].expense).toBe(500);
  });
});

describe("anggaran", () => {
  const budgets: Budget[] = [
    { id: "1", period_type: "monthly", category_id: null, period_start: "2026-09-01", amount: 1000 },
    { id: "2", period_type: "monthly", category_id: null, period_start: "2026-10-01", amount: 2000 },
    { id: "3", period_type: "weekly", category_id: null, period_start: "2026-10-05", amount: 400 },
    { id: "4", period_type: "monthly", category_id: "makan", period_start: "2026-10-01", amount: 0 },
  ];

  it("batas berlaku sejak periode terkait sampai diubah", () => {
    expect(resolveLimit(budgets, "monthly", null, "2026-08-01")).toBe(0);
    expect(resolveLimit(budgets, "monthly", null, "2026-09-01")).toBe(1000);
    expect(resolveLimit(budgets, "monthly", null, "2026-10-01")).toBe(2000);
    expect(resolveLimit(budgets, "monthly", null, "2027-03-01")).toBe(2000);
    expect(resolveLimit(budgets, "weekly", null, "2026-10-19")).toBe(400);
    expect(resolveLimit(budgets, "monthly", "makan", "2026-10-01")).toBe(0); // 0 = tanpa batas
  });

  it("menghormati pilihan hitung mingguan/bulanan", () => {
    const t = [
      tx({ type: "expense", amount: 100, tx_date: "2026-10-20" }),
      tx({ type: "expense", amount: 50, tx_date: "2026-10-20", count_weekly: false }),
      tx({ type: "expense", amount: 25, tx_date: "2026-10-20", count_monthly: false }),
      tx({ type: "income", amount: 999, tx_date: "2026-10-20" }),
      tx({ type: "transfer", amount: 999, tx_date: "2026-10-20", to_account_id: "x" }),
    ];
    expect(spentInPeriod(t, "weekly", null, "2026-10-19", "2026-10-25")).toBe(125);
    expect(spentInPeriod(t, "monthly", null, "2026-10-01", "2026-10-31")).toBe(150);
  });

  it("status 80% dan 100%", () => {
    expect(budgetStatus(79, 100).level).toBe("ok");
    expect(budgetStatus(80, 100).level).toBe("warning");
    expect(budgetStatus(99, 100).level).toBe("warning");
    expect(budgetStatus(100, 100).level).toBe("over");
    expect(budgetStatus(150, 100)).toMatchObject({ level: "over", remaining: -50 });
    expect(budgetStatus(10, 0).level).toBe("none");
  });

  it("riwayat anggaran mengikuti batas per periode", () => {
    const t = [tx({ type: "expense", amount: 700, tx_date: "2026-09-10" })];
    const h = budgetHistory(budgets, t, "monthly", "2026-10-21", 2);
    expect(h[0]).toMatchObject({ start: "2026-09-01", end: "2026-09-30" });
    expect(h[0].status).toMatchObject({ limit: 1000, spent: 700, level: "ok" });
    expect(h[1].status.limit).toBe(0);
  });
});

describe("insight", () => {
  const categories: Category[] = [
    { id: "makan", name: "Makan", type: "expense", sort_order: 0, default_amount: null },
    { id: "kos", name: "Kos", type: "expense", sort_order: 1, default_amount: null },
  ];

  it("kosong bila tidak ada data", () => {
    expect(buildInsights({ txs: [], budgets: [], categories, today: "2026-10-21" })).toEqual([]);
  });

  it("menghitung kategori terbesar, perbandingan, dan anggaran terlampaui dari data", () => {
    const txs = [
      tx({ type: "expense", amount: 900, tx_date: "2026-10-05", category_id: "makan" }),
      tx({ type: "expense", amount: 100, tx_date: "2026-10-06", category_id: "kos" }),
      tx({ type: "expense", amount: 500, tx_date: "2026-09-05", category_id: "makan" }),
      tx({ type: "expense", amount: 5000, tx_date: "2026-09-28", category_id: "makan" }), // di luar periode sama → tak dihitung
    ];
    const budgets: Budget[] = [{ id: "b", period_type: "monthly", category_id: "makan", period_start: "2026-10-01", amount: 800 }];
    const out = buildInsights({ txs, budgets, categories, today: "2026-10-21" });
    const byId = Object.fromEntries(out.map((i) => [i.id, i]));
    expect(byId["top-category"].title).toContain("Makan");
    expect(byId["top-category"].detail).toContain("90%");
    expect(byId["compare"].title).toContain("naik");
    expect(byId["compare"].title).toContain("100%"); // 1000 vs 500
    expect(byId["budget-monthly-makan"].tone).toBe("danger");
  });
});

describe("perencanaan", () => {
  it("gaji − (biaya tetap + anggaran) = belum dialokasikan", () => {
    const s = summarizePlan(5_000_000, [
      { kind: "fixed", amount: 1_500_000 },
      { kind: "budget", amount: 2_000_000 },
      { kind: "budget", amount: 500_000 },
    ]);
    expect(s).toMatchObject({ fixedTotal: 1_500_000, budgetTotal: 2_500_000, unallocated: 1_000_000 });
    expect(summarizePlan(1000, [{ kind: "budget", amount: 1500 }]).unallocated).toBe(-500);
  });
});

describe("validasi transaksi", () => {
  const base = {
    type: "expense" as const,
    amount: 1000,
    category_id: "0b6c2a1e-6f7e-4c43-8d0b-1c6f6a8f9a11",
    account_id: "1b6c2a1e-6f7e-4c43-8d0b-1c6f6a8f9a11",
    tx_date: "2026-10-21",
    payment_method: "cash" as const,
  };

  it("menerima transaksi valid", () => {
    expect(transactionSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ["nominal nol", { amount: 0 }],
    ["nominal negatif", { amount: -1 }],
    ["nominal pecahan", { amount: 10.5 }],
    ["tanggal kosong", { tx_date: "" }],
    ["tanggal mustahil", { tx_date: "2026-02-30" }],
    ["tanpa kategori", { category_id: null }],
    ["tanpa metode", { payment_method: null }],
  ])("menolak %s", (_n, patch) => {
    expect(transactionSchema.safeParse({ ...base, ...patch }).success).toBe(false);
  });

  it("transfer harus punya tujuan berbeda", () => {
    const t = { type: "transfer" as const, amount: 5, account_id: base.account_id, tx_date: base.tx_date };
    expect(transactionSchema.safeParse(t).success).toBe(false);
    expect(transactionSchema.safeParse({ ...t, to_account_id: base.account_id }).success).toBe(false);
    expect(transactionSchema.safeParse({ ...t, to_account_id: base.category_id }).success).toBe(true);
  });
});

describe("CSV", () => {
  it("meloloskan karakter khusus dan mencegah formula injection", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(-500)).toBe("-500"); // angka tetap angka
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a"], [["x"]]).startsWith("﻿")).toBe(true);
  });
});

describe("periode bulan dengan tanggal mulai (gajian)", () => {
  it("cycleStart/cycleEnd mengikuti tanggal mulai", async () => {
    const { cycleStart, cycleEnd, addCycles } = await import("../dates");
    expect(cycleStart("2026-10-24", 25)).toBe("2026-09-25");
    expect(cycleStart("2026-10-25", 25)).toBe("2026-10-25");
    expect(cycleStart("2026-01-10", 25)).toBe("2025-12-25");
    expect(cycleEnd("2026-10-25", 25)).toBe("2026-11-24");
    expect(addCycles("2026-10-25", -1, 25)).toBe("2026-09-25");
    expect(cycleStart("2026-10-24", 1)).toBe("2026-10-01");
    expect(cycleEnd("2026-10-01", 1)).toBe("2026-10-31");
  });
});
