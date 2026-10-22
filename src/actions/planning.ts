"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { getTransactionsInRange } from "@/lib/data/queries";
import { addMonths, isValidISODate, monthEnd } from "@/lib/dates";
import { FALLBACK_SHARE, PLAN_TEMPLATE, suggestAmount } from "@/lib/finance/plan";
import { idSchema, nonNegativeAmountSchema, planItemSchema } from "@/lib/validation";

const monthSchema = z
  .string()
  .refine((v) => isValidISODate(v) && v.endsWith("-01"), "Bulan tidak valid");

async function ensurePlan(supabase: SupabaseClient, userId: string, month: string, salary?: number) {
  const { data: existing, error } = await supabase
    .from("financial_plans")
    .select("id")
    .eq("month", month)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing.id as string;

  const { data, error: insertError } = await supabase
    .from("financial_plans")
    .insert({ user_id: userId, month, salary: salary ?? 0 })
    .select("id")
    .single();
  if (insertError) throw new Error(insertError.message);
  return data.id as string;
}

export async function savePlanSalary(month: string, salary: number) {
  const parsed = parseInput(z.object({ month: monthSchema, salary: nonNegativeAmountSchema }), { month, salary });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { error } = await supabase
      .from("financial_plans")
      .upsert({ user_id: user.id, month: parsed.data.month, salary: parsed.data.salary }, { onConflict: "user_id,month" });
    if (error) return fail(dbError(error, "Gaji gagal disimpan."));
    revalidatePath("/", "layout");
    return success("Gaji bulanan disimpan.");
  });
}

export async function savePlanItem(
  month: string,
  itemId: string | null,
  input: { name: string; kind: "fixed" | "budget"; category_id?: string | null; amount: number },
) {
  const m = monthSchema.safeParse(month);
  if (!m.success) return fail("Bulan tidak valid.");
  const parsed = parseInput(planItemSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const row = {
      name: parsed.data.name,
      kind: parsed.data.kind,
      category_id: parsed.data.category_id ?? null,
      amount: parsed.data.amount,
    };
    if (itemId) {
      if (!idSchema.safeParse(itemId).success) return fail("ID pos tidak valid.");
      const { error } = await supabase.from("plan_items").update(row).eq("id", itemId);
      if (error) return fail(dbError(error, "Pos gagal diperbarui."));
    } else {
      const planId = await ensurePlan(supabase, user.id, m.data);
      const { data: last } = await supabase
        .from("plan_items")
        .select("sort_order")
        .eq("plan_id", planId)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error } = await supabase
        .from("plan_items")
        .insert({ ...row, user_id: user.id, plan_id: planId, sort_order: (last?.sort_order ?? -1) + 1 });
      if (error) return fail(dbError(error, "Pos gagal ditambahkan."));
    }
    revalidatePath("/", "layout");
    return success(itemId ? "Pos diperbarui." : "Pos ditambahkan.");
  });
}

export async function deletePlanItem(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID pos tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("plan_items").delete().eq("id", id);
    if (error) return fail(dbError(error, "Pos gagal dihapus."));
    revalidatePath("/", "layout");
    return success("Pos dihapus.");
  });
}

/** Salin gaji dan seluruh pos dari bulan sebelumnya (hanya jika bulan ini masih kosong). */
export async function copyPlanFromPreviousMonth(month: string) {
  const m = monthSchema.safeParse(month);
  if (!m.success) return fail("Bulan tidak valid.");

  return withAuth(async ({ supabase, user }) => {
    const { data: prev } = await supabase
      .from("financial_plans")
      .select("id, salary")
      .eq("month", addMonths(m.data, -1))
      .maybeSingle();
    if (!prev) return fail("Belum ada perencanaan di bulan sebelumnya.");

    const planId = await ensurePlan(supabase, user.id, m.data, prev.salary);
    const { count } = await supabase
      .from("plan_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    if ((count ?? 0) > 0) return fail("Perencanaan bulan ini sudah memiliki pos.");

    const { data: items } = await supabase
      .from("plan_items")
      .select("name, kind, category_id, amount, sort_order")
      .eq("plan_id", prev.id);
    if (items?.length) {
      const { error } = await supabase
        .from("plan_items")
        .insert(items.map((i) => ({ ...i, user_id: user.id, plan_id: planId })));
      if (error) return fail(dbError(error, "Pos gagal disalin."));
    }
    await supabase.from("financial_plans").update({ salary: prev.salary }).eq("id", planId);

    revalidatePath("/", "layout");
    return success("Perencanaan disalin dari bulan sebelumnya.");
  });
}

/** Isi pos-pos umum (nominal 0) untuk dilengkapi sendiri. Hanya jika belum ada pos. */
export async function applyPlanTemplate(month: string) {
  const m = monthSchema.safeParse(month);
  if (!m.success) return fail("Bulan tidak valid.");

  return withAuth(async ({ supabase, user }) => {
    const planId = await ensurePlan(supabase, user.id, m.data);
    const { count } = await supabase
      .from("plan_items")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", planId);
    if ((count ?? 0) > 0) return fail("Perencanaan bulan ini sudah memiliki pos.");

    const { data: cats } = await supabase.from("categories").select("id, name").eq("type", "expense");
    const byName = new Map((cats ?? []).map((c) => [c.name as string, c.id as string]));

    const { error } = await supabase.from("plan_items").insert(
      PLAN_TEMPLATE.map((t, i) => ({
        user_id: user.id,
        plan_id: planId,
        name: t.name,
        kind: t.kind,
        category_id: t.category ? (byName.get(t.category) ?? null) : null,
        amount: 0,
        sort_order: i,
      })),
    );
    if (error) return fail(dbError(error, "Template gagal diterapkan."));

    revalidatePath("/", "layout");
    return success("Pos umum ditambahkan. Isi nominalnya sesuai rencana Anda.");
  });
}

/**
 * Buat pos rencana otomatis dari riwayat 3 bulan terakhir (atau porsi gaji bila belum ada riwayat).
 * Hanya MENAMBAH pos yang belum ada; pos yang sudah Anda buat atau ubah tidak disentuh.
 */
export async function autoGeneratePlan(month: string) {
  const m = monthSchema.safeParse(month);
  if (!m.success) return fail("Bulan tidak valid.");

  return withAuth(async ({ supabase, user }) => {
    const planId = await ensurePlan(supabase, user.id, m.data);
    const histFrom = addMonths(m.data, -3);
    const histTo = monthEnd(addMonths(m.data, -1));

    const [{ data: plan }, { data: cats }, { data: existing }, histTxs, monthTxs] = await Promise.all([
      supabase.from("financial_plans").select("salary").eq("id", planId).single(),
      supabase.from("categories").select("id, name, type"),
      supabase.from("plan_items").select("name, category_id, sort_order").eq("plan_id", planId),
      getTransactionsInRange(supabase, histFrom, histTo),
      getTransactionsInRange(supabase, m.data, monthEnd(m.data)),
    ]);

    const categories = cats ?? [];
    const salaryCat = categories.find((c) => c.type === "income" && String(c.name).trim().toLowerCase() === "gaji");
    const incomeOf = (txs: typeof histTxs) =>
      salaryCat ? txs.filter((t) => t.type === "income" && t.category_id === salaryCat.id) : [];
    const thisMonthSalary = incomeOf(monthTxs).reduce((s, t) => s + t.amount, 0);
    const histSalaryMonths = new Set(incomeOf(histTxs).map((t) => t.tx_date.slice(0, 7)));
    const histSalary = incomeOf(histTxs).reduce((s, t) => s + t.amount, 0) / Math.max(1, histSalaryMonths.size);
    const salary = thisMonthSalary || (plan?.salary ?? 0) || Math.round(histSalary);

    // Rata-rata pengeluaran per kategori pada bulan-bulan yang punya data.
    const spendMonths = new Set<string>();
    const sumByCat = new Map<string, number>();
    for (const t of histTxs) {
      if (t.type !== "expense" || !t.category_id) continue;
      spendMonths.add(t.tx_date.slice(0, 7));
      sumByCat.set(t.category_id, (sumByCat.get(t.category_id) ?? 0) + t.amount);
    }
    const divisor = Math.max(1, spendMonths.size);
    const avgOf = (categoryId: string | null) => (categoryId ? (sumByCat.get(categoryId) ?? 0) / divisor : 0);

    const items = existing ?? [];
    const takenNames = new Set(items.map((i) => String(i.name).trim().toLowerCase()));
    const takenCats = new Set(items.map((i) => i.category_id).filter(Boolean) as string[]);
    const expenseCats = categories.filter((c) => c.type === "expense");
    const byName = new Map(expenseCats.map((c) => [String(c.name), String(c.id)]));

    const rows: { name: string; kind: "fixed" | "budget"; category_id: string | null; amount: number }[] = [];
    const claim = (name: string, kind: "fixed" | "budget", categoryId: string | null, amount: number) => {
      rows.push({ name, kind, category_id: categoryId, amount });
      takenNames.add(name.trim().toLowerCase());
      if (categoryId) takenCats.add(categoryId);
    };

    for (const t of PLAN_TEMPLATE) {
      const categoryId = t.category ? (byName.get(t.category) ?? null) : null;
      if (takenNames.has(t.name.toLowerCase()) || (categoryId && takenCats.has(categoryId))) continue;
      const amount = suggestAmount({ average: avgOf(categoryId), salary, fallbackShare: FALLBACK_SHARE[t.name] });
      claim(t.name, t.kind, categoryId, amount);
    }
    // Kategori lain yang rutin dipakai tetapi tidak ada di template.
    for (const c of expenseCats) {
      const categoryId = String(c.id);
      const name = String(c.name);
      const average = avgOf(categoryId);
      if (average <= 0 || takenCats.has(categoryId) || takenNames.has(name.trim().toLowerCase())) continue;
      claim(name, "budget", categoryId, suggestAmount({ average, salary }));
    }

    if (rows.length === 0) return fail("Semua pos umum sudah ada di rencana bulan ini.");

    const start = items.reduce((max, i) => Math.max(max, Number(i.sort_order) + 1), 0);
    const { error } = await supabase
      .from("plan_items")
      .insert(rows.map((r, i) => ({ ...r, user_id: user.id, plan_id: planId, sort_order: start + i })));
    if (error) return fail(dbError(error, "Perencanaan otomatis gagal dibuat."));

    if (!plan?.salary && salary > 0 && !thisMonthSalary) {
      await supabase.from("financial_plans").update({ salary }).eq("id", planId);
    }

    revalidatePath("/", "layout");
    const basis = spendMonths.size > 0 ? `rata-rata ${spendMonths.size} bulan terakhir` : "porsi dari gaji";
    return success(`${rows.length} pos dibuat otomatis (${basis}). Silakan ubah nominalnya bila perlu.`);
  });
}
