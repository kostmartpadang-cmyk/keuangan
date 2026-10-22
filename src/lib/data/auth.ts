import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { fail, type ActionResult } from "@/lib/action";
import { normalizeStartDay } from "@/lib/dates";

/** Pengguna terautentikasi (dari klaim JWT yang sudah diverifikasi). */
export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthContext {
  supabase: SupabaseClient;
  user: AuthUser;
}

/**
 * Verifikasi sesi lewat getClaims(): tanda tangan JWT diperiksa secara lokal (kunci publik di-cache),
 * jadi tidak perlu round-trip ke server Auth di setiap navigasi seperti getUser().
 */
async function authUser(supabase: SupabaseClient): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
}

/** Konteks terautentikasi untuk Server Component; dialihkan ke /login bila tidak ada sesi. */
export const requireUser = cache(async (): Promise<AuthContext> => {
  const supabase = await createClient();
  const user = await authUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
});

/** Konteks untuk Server Action; mengembalikan null bila sesi sudah berakhir. */
export async function getActionContext(): Promise<AuthContext | null> {
  const supabase = await createClient();
  const user = await authUser(supabase);
  if (!user) return null;
  return { supabase, user };
}

/** Profil pengguna; membuat data awal bila belum ada (cadangan untuk trigger signup). */
export const getProfile = cache(async (): Promise<Profile> => {
  const { supabase, user } = await requireUser();
  const read = async () => {
    const res = await supabase.from("profiles").select("id, full_name, month_start_day").eq("id", user.id).maybeSingle();
    if (!res.error) return res.data as Pick<Profile, "id" | "full_name" | "month_start_day"> | null;
    // Kolom month_start_day belum ada (migrasi belum dijalankan): pakai bulan kalender.
    const legacy = await supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle();
    return legacy.data ? { ...(legacy.data as Pick<Profile, "id" | "full_name">), month_start_day: 1 } : null;
  };

  let data = await read();
  if (!data) {
    await supabase.rpc("bootstrap_current_user");
    data = await read();
  }
  return data ? { ...data, month_start_day: normalizeStartDay(data.month_start_day) } : { id: user.id, full_name: null, month_start_day: 1 };
});

/** Tanggal mulai "bulan" pengguna untuk Server Action (1 bila belum diatur / migrasi belum dijalankan). */
export async function getMonthStartDay(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data } = await supabase.from("profiles").select("month_start_day").eq("id", userId).maybeSingle();
  return normalizeStartDay(data?.month_start_day);
}

/** Bungkus Server Action: pastikan sesi valid, tangkap error tak terduga. */
export async function withAuth<T = undefined>(
  fn: (ctx: AuthContext) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const ctx = await getActionContext();
  if (!ctx) return fail("Sesi Anda berakhir. Silakan masuk kembali.");
  try {
    return await fn(ctx);
  } catch (error) {
    console.error("[action]", error);
    return fail("Terjadi kesalahan di server. Coba lagi sebentar lagi.");
  }
}
