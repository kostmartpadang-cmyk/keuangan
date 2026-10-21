"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fail, parseInput, success, type ActionResult } from "@/lib/action";
import { getActionContext } from "@/lib/data/auth";
import { forgotSchema, loginSchema, profileSchema, registerSchema, resetSchema } from "@/lib/validation";

/** Hanya izinkan path internal agar tidak jadi open redirect. */
function safeNext(next: string | undefined | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")) return next;
  return "/dashboard";
}

async function getOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email atau kata sandi salah.";
  if (m.includes("email not confirmed")) return "Email belum dikonfirmasi. Periksa kotak masuk Anda.";
  if (m.includes("already registered") || m.includes("already been registered")) return "Email sudah terdaftar. Silakan masuk.";
  if (m.includes("rate limit") || m.includes("too many")) return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.";
  if (m.includes("password should be") || m.includes("weak")) return "Kata sandi terlalu lemah. Gunakan minimal 8 karakter.";
  if (m.includes("same password")) return "Kata sandi baru harus berbeda dari yang lama.";
  return "Terjadi kesalahan saat memproses permintaan. Coba lagi.";
}

export async function login(input: { email: string; password: string }, next?: string): Promise<ActionResult> {
  const parsed = parseInput(loginSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authMessage(error.message));

  redirect(safeNext(next));
}

export async function register(input: {
  full_name: string;
  email: string;
  password: string;
  confirm: string;
}): Promise<ActionResult> {
  const parsed = parseInput(registerSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const supabase = await createClient();
  const origin = await getOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return fail(authMessage(error.message));

  // Jika konfirmasi email dimatikan di Supabase, sesi langsung aktif.
  if (data.session) redirect("/dashboard");

  return success("Pendaftaran berhasil. Kami mengirim tautan konfirmasi ke email Anda — buka tautan itu lalu masuk.");
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function requestPasswordReset(input: { email: string }): Promise<ActionResult> {
  const parsed = parseInput(forgotSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error && error.message.toLowerCase().includes("rate")) return fail(authMessage(error.message));

  // Respons sama baik email terdaftar maupun tidak, agar tidak membocorkan daftar akun.
  return success("Jika email terdaftar, tautan untuk mengatur ulang kata sandi sudah dikirim.");
}

export async function updatePassword(input: { password: string; confirm: string }): Promise<ActionResult> {
  const parsed = parseInput(resetSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const ctx = await getActionContext();
  if (!ctx) return fail("Sesi tidak ditemukan. Buka kembali tautan dari email Anda atau masuk terlebih dahulu.");

  const { error } = await ctx.supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authMessage(error.message));
  return success("Kata sandi berhasil diperbarui.");
}

export async function updateProfile(input: { full_name: string }): Promise<ActionResult> {
  const parsed = parseInput(profileSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);

  const ctx = await getActionContext();
  if (!ctx) return fail("Sesi Anda berakhir. Silakan masuk kembali.");

  const { error } = await ctx.supabase
    .from("profiles")
    .upsert({ id: ctx.user.id, full_name: parsed.data.full_name });
  if (error) return fail("Profil gagal disimpan.");

  revalidatePath("/", "layout");
  return success("Profil diperbarui.");
}
