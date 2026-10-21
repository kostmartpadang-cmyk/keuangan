"use server";

import { revalidatePath } from "next/cache";
import { dbError, fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { categorySchema, idSchema, nameSchema } from "@/lib/validation";
import { z } from "zod";

export async function createCategory(input: { name: string; type: "income" | "expense" }) {
  const parsed = parseInput(categorySchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase, user }) => {
    const { data: last } = await supabase
      .from("categories")
      .select("sort_order")
      .eq("type", parsed.data.type)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase
      .from("categories")
      .insert({ ...parsed.data, user_id: user.id, sort_order: (last?.sort_order ?? -1) + 1 });
    if (error) {
      if (error.code === "23505") return fail("Kategori dengan nama itu sudah ada.", { name: "Nama sudah dipakai" });
      return fail(dbError(error, "Kategori gagal dibuat."));
    }
    revalidatePath("/", "layout");
    return success("Kategori ditambahkan.");
  });
}

export async function renameCategory(id: string, name: string) {
  const parsed = parseInput(z.object({ id: idSchema, name: nameSchema("Nama kategori") }), { id, name });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  return withAuth(async ({ supabase }) => {
    const { data, error } = await supabase
      .from("categories")
      .update({ name: parsed.data.name })
      .eq("id", parsed.data.id)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return fail("Kategori dengan nama itu sudah ada.");
      return fail(dbError(error, "Kategori gagal diubah."));
    }
    if (!data) return fail("Kategori tidak ditemukan.");
    revalidatePath("/", "layout");
    return success("Kategori diperbarui.");
  });
}

export async function deleteCategory(id: string) {
  if (!idSchema.safeParse(id).success) return fail("ID kategori tidak valid.");
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      if (error.code === "23503" || error.code === "23001") {
        return fail("Kategori sudah dipakai transaksi sehingga tidak bisa dihapus. Ubah nama kategori bila perlu.");
      }
      return fail(dbError(error, "Kategori gagal dihapus."));
    }
    revalidatePath("/", "layout");
    return success("Kategori dihapus.");
  });
}
