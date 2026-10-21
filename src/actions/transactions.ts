"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { idSchema, transactionSchema, type TransactionInput } from "@/lib/validation";

function toRow(data: ReturnType<typeof transactionSchema.parse>) {
  const isTransfer = data.type === "transfer";
  return {
    type: data.type,
    amount: data.amount,
    category_id: isTransfer ? null : data.category_id,
    account_id: data.account_id,
    to_account_id: isTransfer ? data.to_account_id : null,
    tx_date: data.tx_date,
    payment_method: isTransfer ? null : data.payment_method,
    note: data.note,
    // Pilihan penghitungan anggaran hanya relevan untuk pengeluaran.
    count_weekly: data.type === "expense" ? data.count_weekly : true,
    count_monthly: data.type === "expense" ? data.count_monthly : true,
  };
}

/** Tambah (id = null) atau ubah transaksi. Kepemilikan akun/kategori dijaga FK komposit + RLS. */
export async function saveTransaction(id: string | null, input: TransactionInput) {
  const parsed = parseInput(transactionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const row = toRow(parsed.data);

    if (id) {
      if (!idSchema.safeParse(id).success) return fail("ID transaksi tidak valid.");
      const { data, error } = await supabase
        .from("transactions")
        .update(row)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) return fail(dbError(error, "Transaksi gagal diperbarui."));
      if (!data) return fail("Transaksi tidak ditemukan.");
    } else {
      const { error } = await supabase
        .from("transactions")
        .insert({ ...row, user_id: user.id, client_id: parsed.data.client_id ?? null });
      // client_id yang sama berarti permintaan yang sama terkirim ulang → sudah tersimpan, jangan duplikat.
      const duplicate = error?.code === "23505" && error.message.includes("transactions_client_id_uq");
      if (error && !duplicate) return fail(dbError(error, "Transaksi gagal disimpan."));
    }

    revalidatePath("/", "layout");
    return success(id ? "Transaksi diperbarui." : "Transaksi disimpan.");
  });
}

export async function deleteTransaction(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID transaksi tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return fail(dbError(error, "Transaksi gagal dihapus."));
    revalidatePath("/", "layout");
    return success("Transaksi dihapus.");
  });
}
