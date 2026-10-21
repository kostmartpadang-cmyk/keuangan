"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { addMonths, isValidISODate } from "@/lib/dates";
import { PLAN_TEMPLATE } from "@/lib/finance/plan";
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
