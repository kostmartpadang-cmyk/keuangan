"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { todayJakarta } from "@/lib/dates";
import { periodStartOf } from "@/lib/finance/budgets";
import { budgetSchema } from "@/lib/validation";
import type { BudgetPeriodType } from "@/lib/types";

/**
 * Atur batas anggaran mulai periode berjalan (Senin untuk mingguan, tanggal 1 untuk bulanan).
 * Batas tetap berlaku untuk periode berikutnya sampai diubah; amount 0 = tanpa batas.
 */
export async function setBudget(input: {
  period_type: BudgetPeriodType;
  category_id: string | null;
  amount: number;
}) {
  const parsed = parseInput(budgetSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { period_type, category_id, amount } = parsed.data;
    const period_start = periodStartOf(period_type, todayJakarta());

    let find = supabase
      .from("budgets")
      .select("id")
      .eq("period_type", period_type)
      .eq("period_start", period_start);
    find = category_id ? find.eq("category_id", category_id) : find.is("category_id", null);
    const { data: existing, error: findError } = await find.maybeSingle();
    if (findError) return fail(dbError(findError, "Anggaran gagal disimpan."));

    const { error } = existing
      ? await supabase.from("budgets").update({ amount }).eq("id", existing.id)
      : await supabase
          .from("budgets")
          .insert({ user_id: user.id, period_type, category_id, period_start, amount });
    if (error) return fail(dbError(error, "Anggaran gagal disimpan."));

    revalidatePath("/", "layout");
    return success(amount === 0 ? "Batas anggaran dihapus." : "Anggaran disimpan.");
  });
}
