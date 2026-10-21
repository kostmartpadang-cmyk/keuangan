"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { contributionSchema, goalSchema, idSchema } from "@/lib/validation";
import type { GoalStatus } from "@/lib/types";

/**
 * Status berjalan ⇄ tercapai mengikuti total kontribusi. Tujuan yang dibatalkan tidak diubah otomatis.
 */
async function syncGoalStatus(supabase: SupabaseClient, goalId: string) {
  const { data: goal } = await supabase
    .from("financial_goals")
    .select("target_amount, status")
    .eq("id", goalId)
    .maybeSingle();
  if (!goal || goal.status === "cancelled") return;

  const { data: rows } = await supabase.from("goal_contributions").select("amount").eq("goal_id", goalId);
  const collected = (rows ?? []).reduce((sum, r) => sum + (r.amount as number), 0);
  const next: GoalStatus = collected >= goal.target_amount ? "achieved" : "active";
  if (next !== goal.status) await supabase.from("financial_goals").update({ status: next }).eq("id", goalId);
}

export async function createGoal(input: {
  name: string;
  target_amount: number;
  deadline?: string | null;
  note?: string | null;
}) {
  const parsed = parseInput(goalSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { error } = await supabase.from("financial_goals").insert({ ...parsed.data, user_id: user.id });
    if (error) return fail(dbError(error, "Tujuan gagal dibuat."));
    revalidatePath("/", "layout");
    return success("Tujuan ditambahkan.");
  });
}

export async function updateGoal(
  id: string,
  input: { name: string; target_amount: number; deadline?: string | null; note?: string | null },
) {
  const parsed = parseInput(goalSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (!idSchema.safeParse(id).success) return fail("ID tujuan tidak valid.");

  return withAuth(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("financial_goals")
      .update(parsed.data)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return fail(dbError(error, "Tujuan gagal diperbarui."));
    if (!data) return fail("Tujuan tidak ditemukan.");
    await syncGoalStatus(supabase, id);
    revalidatePath("/", "layout");
    return success("Tujuan diperbarui.");
  });
}

export async function setGoalCancelled(id: string, cancelled: boolean) {
  if (!idSchema.safeParse(id).success) return fail("ID tujuan tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase
      .from("financial_goals")
      .update({ status: cancelled ? "cancelled" : "active" })
      .eq("id", id);
    if (error) return fail(dbError(error, "Status tujuan gagal diubah."));
    if (!cancelled) await syncGoalStatus(supabase, id);
    revalidatePath("/", "layout");
    return success(cancelled ? "Tujuan dibatalkan." : "Tujuan diaktifkan kembali.");
  });
}

export async function deleteGoal(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID tujuan tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("financial_goals").delete().eq("id", id);
    if (error) return fail(dbError(error, "Tujuan gagal dihapus."));
    revalidatePath("/", "layout");
    return success("Tujuan dihapus.");
  });
}

/** Kontribusi hanya penanda alokasi; tidak membuat transaksi dan tidak mengubah saldo akun. */
export async function addContribution(input: {
  goal_id: string;
  amount: number;
  contributed_on: string;
  note?: string | null;
}) {
  const parsed = parseInput(contributionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { data: goal } = await supabase
      .from("financial_goals")
      .select("status")
      .eq("id", parsed.data.goal_id)
      .maybeSingle();
    if (!goal) return fail("Tujuan tidak ditemukan.");
    if (goal.status === "cancelled") return fail("Tujuan ini sudah dibatalkan. Aktifkan kembali untuk menambah kontribusi.");

    const { error } = await supabase.from("goal_contributions").insert({ ...parsed.data, user_id: user.id });
    if (error) return fail(dbError(error, "Kontribusi gagal disimpan."));

    await syncGoalStatus(supabase, parsed.data.goal_id);
    revalidatePath("/", "layout");
    return success("Kontribusi dicatat.");
  });
}

export async function deleteContribution(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID kontribusi tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { data: row } = await supabase.from("goal_contributions").select("goal_id").eq("id", id).maybeSingle();
    if (!row) return fail("Kontribusi tidak ditemukan.");
    const { error } = await supabase.from("goal_contributions").delete().eq("id", id);
    if (error) return fail(dbError(error, "Kontribusi gagal dihapus."));
    await syncGoalStatus(supabase, row.goal_id as string);
    revalidatePath("/", "layout");
    return success("Kontribusi dihapus.");
  });
}
