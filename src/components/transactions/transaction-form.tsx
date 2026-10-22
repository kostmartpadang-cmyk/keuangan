"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveTransaction } from "@/actions/transactions";
import { Field, MoneyInput, NativeSelect } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "@/hooks/use-run-action";
import { COUNT_MODES, PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS, countModeOf, type CountMode } from "@/lib/constants";
import { formatRupiah } from "@/lib/money";
import type { Account, Category, PaymentMethod, Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { transactionSchema } from "@/lib/validation";

const TYPE_STYLE: Record<TransactionType, string> = {
  income: "data-[on=true]:bg-income-soft data-[on=true]:text-income data-[on=true]:border-income/40",
  expense: "data-[on=true]:bg-expense-soft data-[on=true]:text-expense data-[on=true]:border-expense/40",
  transfer: "data-[on=true]:bg-accent data-[on=true]:text-accent-foreground data-[on=true]:border-primary/40",
};

function methodForKind(kind: Account["kind"]): PaymentMethod | null {
  return kind === "cash" ? "cash" : kind === "bank" ? "qris_bank" : null;
}

export function TransactionForm({
  accounts,
  categories,
  transaction,
  defaultType = "expense",
  today,
}: {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
  defaultType?: TransactionType;
  today: string;
}) {
  const router = useRouter();
  const { run, pending } = useRunAction();
  const clientId = useRef<string>(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const editing = Boolean(transaction);

  const usable = accounts.filter((a) => !a.is_archived || a.id === transaction?.account_id || a.id === transaction?.to_account_id);
  const firstFor = (m: PaymentMethod) => usable.find((a) => methodForKind(a.kind) === m) ?? usable[0];

  const initialMethod: PaymentMethod = transaction?.payment_method ?? "qris_bank";
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [amount, setAmount] = useState(transaction?.amount ?? 0);
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [accountId, setAccountId] = useState(transaction?.account_id ?? firstFor(initialMethod)?.id ?? "");
  const [toAccountId, setToAccountId] = useState(transaction?.to_account_id ?? "");
  const [date, setDate] = useState(transaction?.tx_date ?? today);
  const [method, setMethod] = useState<PaymentMethod>(initialMethod);
  const [note, setNote] = useState(transaction?.note ?? "");
  const [countMode, setCountMode] = useState<CountMode>(
    transaction ? countModeOf(transaction.count_weekly, transaction.count_monthly) : "both",
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeCategories = categories.filter((c) => c.type === type);
  const isTransfer = type === "transfer";

  // Nominal tetap kategori (mis. transportasi) mengisi nominal otomatis, selama nominal belum diubah manual.
  const lastAuto = useRef(0);
  const selected = typeCategories.find((c) => c.id === categoryId);

  function changeCategory(id: string) {
    setCategoryId(id);
    const fixed = categories.find((c) => c.id === id)?.default_amount ?? 0;
    if (fixed > 0 && type === "expense" && (amount === 0 || amount === lastAuto.current)) {
      setAmount(fixed);
      lastAuto.current = fixed;
    }
  }

  function changeType(next: TransactionType) {
    setType(next);
    setCategoryId("");
    setErrors({});
    if (next === "transfer" && !toAccountId) {
      setToAccountId(usable.find((a) => a.id !== accountId)?.id ?? "");
    }
  }

  function changeMethod(next: PaymentMethod) {
    setMethod(next);
    const match = usable.find((a) => methodForKind(a.kind) === next);
    if (match) setAccountId(match.id);
  }

  function changeAccount(id: string) {
    setAccountId(id);
    const kind = usable.find((a) => a.id === id)?.kind;
    const m = kind ? methodForKind(kind) : null;
    if (m) setMethod(m);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mode = COUNT_MODES.find((m) => m.value === countMode)!;
    const payload = {
      type,
      amount,
      category_id: isTransfer ? null : categoryId || null,
      account_id: accountId,
      to_account_id: isTransfer ? toAccountId || null : null,
      tx_date: date,
      payment_method: isTransfer ? null : method,
      note,
      count_weekly: mode.weekly,
      count_monthly: mode.monthly,
      client_id: editing ? null : clientId.current || null,
    };

    const check = transactionSchema.safeParse(payload);
    if (!check.success) {
      const fe: Record<string, string> = {};
      for (const issue of check.error.issues) fe[String(issue.path[0] ?? "_")] ||= issue.message;
      setErrors(fe);
      return;
    }
    setErrors({});

    run(() => saveTransaction(transaction?.id ?? null, payload), {
      onSuccess: () => {
        router.push("/transactions");
        router.refresh();
      },
      onError: (r) => setErrors(r.fieldErrors ?? {}),
    });
  }

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-xl gap-5">
      <div role="radiogroup" aria-label="Tipe transaksi" className="grid grid-cols-3 gap-2">
        {(["expense", "income", "transfer"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            data-on={type === t}
            onClick={() => changeType(t)}
            className={cn(
              "h-11 rounded-xl border text-sm font-semibold text-muted-foreground transition-colors",
              TYPE_STYLE[t],
            )}
          >
            {TRANSACTION_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <Field
        label="Nominal"
        htmlFor="amount"
        error={errors.amount}
        hint={
          selected?.default_amount && type === "expense"
            ? `Nominal tetap ${selected.name}: ${formatRupiah(selected.default_amount)}. Boleh diubah untuk transaksi ini.`
            : undefined
        }
      >
        <MoneyInput id="amount" value={amount} onChange={setAmount} invalid={!!errors.amount} autoFocus={!editing} />
      </Field>

      {!isTransfer && (
        <Field label="Kategori" htmlFor="category" error={errors.category_id}>
          <NativeSelect id="category" value={categoryId} onChange={(e) => changeCategory(e.target.value)} aria-invalid={!!errors.category_id}>
            <option value="">Pilih kategori…</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {!isTransfer && (
        <Field label="Metode pembayaran" error={errors.payment_method}>
          <div role="radiogroup" aria-label="Metode pembayaran" className="grid grid-cols-2 gap-2">
            {(["cash", "qris_bank"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => changeMethod(m)}
                className={cn(
                  "h-11 rounded-xl border text-sm font-medium transition-colors",
                  method === m ? "border-primary/50 bg-accent text-accent-foreground" : "text-muted-foreground",
                )}
              >
                {PAYMENT_METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className={cn("grid gap-5", isTransfer && "sm:grid-cols-2")}>
        <Field label={isTransfer ? "Dari akun" : type === "income" ? "Masuk ke akun" : "Keluar dari akun"} htmlFor="account" error={errors.account_id}>
          <NativeSelect id="account" value={accountId} onChange={(e) => changeAccount(e.target.value)} aria-invalid={!!errors.account_id}>
            {usable.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.is_archived ? " (arsip)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {isTransfer && (
          <Field label="Ke akun" htmlFor="to_account" error={errors.to_account_id}>
            <NativeSelect id="to_account" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} aria-invalid={!!errors.to_account_id}>
              <option value="">Pilih akun tujuan…</option>
              {usable
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
      </div>

      <Field label="Tanggal" htmlFor="date" error={errors.tx_date}>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-invalid={!!errors.tx_date}
          className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 sm:text-sm dark:bg-input/30"
        />
      </Field>

      <Field label="Catatan (opsional)" htmlFor="note" error={errors.note}>
        <Textarea id="note" value={note} maxLength={500} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Mis. makan siang di warung" className="rounded-xl text-base sm:text-sm" />
      </Field>

      {type === "expense" && (
        <Field label="Dihitung ke anggaran" htmlFor="count_mode" hint="Pilih anggaran mana yang terpotong oleh pengeluaran ini.">
          <NativeSelect id="count_mode" value={countMode} onChange={(e) => setCountMode(e.target.value as CountMode)}>
            {COUNT_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}

      {isTransfer && (
        <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Transfer hanya memindahkan uang antar-akun. Tidak dihitung sebagai pemasukan maupun pengeluaran.
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="h-12 flex-1 rounded-xl sm:h-10" onClick={() => router.back()} disabled={pending}>
          Batal
        </Button>
        <Button type="submit" className="h-12 flex-[2] rounded-xl text-base sm:h-10 sm:text-sm" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Simpan perubahan" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
