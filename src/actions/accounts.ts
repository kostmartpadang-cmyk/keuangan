"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { accountSchema, idSchema, type AccountInput } from "@/lib/validation";

export async function createAccount(input: AccountInput) {
  const parsed = parseInput(accountSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { data: last } = await supabase
      .from("accounts")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("accounts").insert({
      ...parsed.data,
      user_id: user.id,
      sort_order: (last?.sort_order ?? -1) + 1,
    });
    if (error) {
      if (error.code === "23505") return fail("Nama akun sudah dipakai.", { name: "Nama akun sudah dipakai" });
      return fail(dbError(error, "Akun gagal dibuat."));
    }
    revalidatePath("/", "layout");
    return success("Akun ditambahkan.");
  });
}

export async function updateAccount(id: string, input: AccountInput) {
  const parsed = parseInput(accountSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  if (!idSchema.safeParse(id).success) return fail("ID akun tidak valid.");

  return withAuth(async ({ supabase }) => {
    const { data, error } = await supabase.from("accounts").update(parsed.data).eq("id", id).select("id").maybeSingle();
    if (error) {
      if (error.code === "23505") return fail("Nama akun sudah dipakai.", { name: "Nama akun sudah dipakai" });
      return fail(dbError(error, "Akun gagal diperbarui."));
    }
    if (!data) return fail("Akun tidak ditemukan.");
    revalidatePath("/", "layout");
    return success("Akun diperbarui.");
  });
}

/** Mengarsipkan hanya diperbolehkan jika saldo akun nol, agar uang tidak "hilang" dari total. */
export async function setAccountArchived(id: string, archived: boolean) {
  if (!idSchema.safeParse(id).success) return fail("ID akun tidak valid.");
  return withAuth(async ({ supabase }) => {
    if (archived) {
      const { data: acc } = await supabase.from("account_balances").select("balance").eq("id", id).maybeSingle();
      if (!acc) return fail("Akun tidak ditemukan.");
      if (acc.balance !== 0) {
        return fail("Saldo akun harus nol sebelum diarsipkan. Pindahkan sisa saldo lewat transfer terlebih dahulu.");
      }
    }
    const { error } = await supabase.from("accounts").update({ is_archived: archived }).eq("id", id);
    if (error) return fail(dbError(error, "Status akun gagal diubah."));
    revalidatePath("/", "layout");
    return success(archived ? "Akun diarsipkan." : "Akun diaktifkan kembali.");
  });
}

export async function deleteAccount(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID akun tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) {
      if (error.code === "23503" || error.code === "23001") return fail("Akun sudah memiliki transaksi sehingga tidak bisa dihapus. Arsipkan saja.");
      return fail(dbError(error, "Akun gagal dihapus."));
    }
    revalidatePath("/", "layout");
    return success("Akun dihapus.");
  });
}
