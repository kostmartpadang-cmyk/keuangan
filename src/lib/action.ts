import type { ZodType } from "zod";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function success<T = undefined>(message?: string, data?: T): ActionResult<T> {
  return { ok: true, message, data };
}

/** Validasi input dengan Zod dan kembalikan pesan error berbahasa Indonesia. */
export function parseInput<T>(
  schema: ZodType<T>,
  input: unknown,
): { ok: true; data: T } | { ok: false; error: string; fieldErrors: Record<string, string> } {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? "Data tidak valid", fieldErrors };
}

/** Terjemahkan error Postgres/Supabase yang umum ke pesan yang bisa dipahami. */
export function dbError(error: { code?: string; message: string } | null | undefined, fallback: string): string {
  if (!error) return fallback;
  switch (error.code) {
    case "23505":
      return "Data dengan nama atau kunci yang sama sudah ada.";
    case "23503":
    case "23001":
      return "Data ini masih dipakai oleh data lain, atau relasinya tidak valid.";
    case "23514":
      return "Data tidak memenuhi aturan validasi.";
    case "42501":
      return "Anda tidak memiliki akses ke data ini.";
    default:
      return fallback;
  }
}
