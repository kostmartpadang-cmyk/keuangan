import { z } from "zod";
import { isValidISODate } from "../dates";

const MAX_AMOUNT = 1_000_000_000_000; // 1 triliun, jauh di bawah batas aman bilangan bulat JS

export const amountSchema = z
  .number({ error: "Nominal harus berupa angka" })
  .int("Nominal harus bilangan bulat")
  .positive("Nominal harus lebih besar dari nol")
  .max(MAX_AMOUNT, "Nominal terlalu besar");

export const nonNegativeAmountSchema = z
  .number({ error: "Nominal harus berupa angka" })
  .int("Nominal harus bilangan bulat")
  .min(0, "Nominal tidak boleh negatif")
  .max(MAX_AMOUNT, "Nominal terlalu besar");

export const dateSchema = z
  .string({ error: "Tanggal wajib diisi" })
  .refine(isValidISODate, "Tanggal tidak valid");

export const optionalDateSchema = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || isValidISODate(v), "Tanggal tidak valid");

export const noteSchema = z
  .string()
  .max(500, "Catatan maksimal 500 karakter")
  .nullable()
  .optional()
  .transform((v) => {
    const t = v?.trim();
    return t ? t : null;
  });

export const nameSchema = (label: string, max = 60) =>
  z
    .string({ error: `${label} wajib diisi` })
    .trim()
    .min(1, `${label} wajib diisi`)
    .max(max, `${label} maksimal ${max} karakter`);

export const idSchema = z.uuid("ID tidak valid");

// ---------------------------------------------------------------------------
// Transaksi
// ---------------------------------------------------------------------------
export const transactionSchema = z
  .object({
    type: z.enum(["income", "expense", "transfer"], { error: "Pilih tipe transaksi" }),
    amount: amountSchema,
    category_id: idSchema.nullable().optional(),
    account_id: idSchema,
    to_account_id: idSchema.nullable().optional(),
    tx_date: dateSchema,
    payment_method: z.enum(["cash", "qris_bank"]).nullable().optional(),
    note: noteSchema,
    count_weekly: z.boolean().default(true),
    count_monthly: z.boolean().default(true),
    client_id: z.uuid().nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.to_account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Pilih akun tujuan" });
      } else if (v.to_account_id === v.account_id) {
        ctx.addIssue({ code: "custom", path: ["to_account_id"], message: "Akun tujuan harus berbeda dari akun asal" });
      }
    } else {
      if (!v.category_id) {
        ctx.addIssue({ code: "custom", path: ["category_id"], message: "Pilih kategori" });
      }
      if (!v.payment_method) {
        ctx.addIssue({ code: "custom", path: ["payment_method"], message: "Pilih metode pembayaran" });
      }
    }
  });

export type TransactionInput = z.input<typeof transactionSchema>;
export type TransactionData = z.output<typeof transactionSchema>;

// ---------------------------------------------------------------------------
// Akun & kategori
// ---------------------------------------------------------------------------
export const accountSchema = z.object({
  name: nameSchema("Nama akun"),
  kind: z.enum(["cash", "bank", "other"], { error: "Pilih jenis akun" }),
  initial_balance: z
    .number({ error: "Saldo awal harus berupa angka" })
    .int("Saldo awal harus bilangan bulat")
    .min(-MAX_AMOUNT)
    .max(MAX_AMOUNT),
});
export type AccountInput = z.input<typeof accountSchema>;

export const categorySchema = z.object({
  name: nameSchema("Nama kategori"),
  type: z.enum(["income", "expense"], { error: "Pilih tipe kategori" }),
});

// ---------------------------------------------------------------------------
// Anggaran
// ---------------------------------------------------------------------------
export const budgetSchema = z.object({
  period_type: z.enum(["weekly", "monthly"]),
  category_id: idSchema.nullable(),
  amount: nonNegativeAmountSchema,
});

// ---------------------------------------------------------------------------
// Perencanaan
// ---------------------------------------------------------------------------
export const planItemSchema = z.object({
  name: nameSchema("Nama pos", 80),
  kind: z.enum(["fixed", "budget"]),
  category_id: idSchema.nullable().optional(),
  amount: nonNegativeAmountSchema,
});

// ---------------------------------------------------------------------------
// Tujuan keuangan
// ---------------------------------------------------------------------------
export const goalSchema = z.object({
  name: nameSchema("Nama tujuan", 100),
  target_amount: amountSchema,
  deadline: optionalDateSchema,
  note: noteSchema,
});

export const contributionSchema = z.object({
  goal_id: idSchema,
  amount: amountSchema,
  contributed_on: dateSchema,
  note: noteSchema,
});

// ---------------------------------------------------------------------------
// Auth & profil
// ---------------------------------------------------------------------------
export const emailSchema = z
  .string({ error: "Email wajib diisi" })
  .trim()
  .min(1, "Email wajib diisi")
  .pipe(z.email("Format email tidak valid"));

export const passwordSchema = z
  .string({ error: "Kata sandi wajib diisi" })
  .min(8, "Kata sandi minimal 8 karakter")
  .max(72, "Kata sandi maksimal 72 karakter");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

export const registerSchema = z
  .object({
    full_name: nameSchema("Nama", 100),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi kata sandi tidak sama" });

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi kata sandi tidak sama" });

export const profileSchema = z.object({ full_name: nameSchema("Nama", 100) });
