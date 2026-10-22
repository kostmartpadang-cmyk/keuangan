import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { fail, type ActionResult } from "@/lib/action";

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
  const read = () => supabase.from("profiles").select("id, full_name").eq("id", user.id).maybeSingle();

  let { data } = await read();
  if (!data) {
    await supabase.rpc("bootstrap_current_user");
    ({ data } = await read());
  }
  return (data as Profile | null) ?? { id: user.id, full_name: null };
});

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
