"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, ArrowRightLeft, Banknote, Landmark, Loader2, Pencil, Plus, Wallet } from "lucide-react";
import { createAccount, deleteAccount, setAccountArchived, updateAccount } from "@/actions/accounts";
import { saveTransaction } from "@/actions/transactions";
import { Field, MoneyInput, NativeSelect } from "@/components/forms/fields";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete";
import { EmptyState, Money } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/hooks/use-run-action";
import { ACCOUNT_KIND_LABELS } from "@/lib/constants";
import { formatRupiah } from "@/lib/money";
import type { AccountKind, AccountWithBalance } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_ICON = { cash: Banknote, bank: Landmark, other: Wallet } as const;

type Errors = Record<string, string>;

function AccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: AccountWithBalance | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "bank");
  const [initial, setInitial] = useState(account?.initial_balance ?? 0);
  const [errors, setErrors] = useState<Errors>({});

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{account ? "Ubah akun" : "Tambah akun"}</DialogTitle>
          <DialogDescription>
            {account
              ? "Mengubah saldo awal akan menggeser saldo akun saat ini dengan selisih yang sama."
              : "Mis. Tunai, QRIS/Rekening, atau dompet digital lain."}
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            const input = { name, kind, initial_balance: initial };
            run(() => (account ? updateAccount(account.id, input) : createAccount(input)), {
              onSuccess: () => onOpenChange(false),
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }}
        >
          <Field label="Nama akun" htmlFor="acc-name" error={errors.name}>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-10" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Jenis" htmlFor="acc-kind" error={errors.kind}>
            <NativeSelect id="acc-kind" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
              {(Object.keys(ACCOUNT_KIND_LABELS) as AccountKind[]).map((k) => (
                <option key={k} value={k}>
                  {ACCOUNT_KIND_LABELS[k]}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Saldo awal" htmlFor="acc-initial" error={errors.initial_balance} hint="Uang yang sudah ada di akun ini sebelum Anda mulai mencatat.">
            <MoneyInput id="acc-initial" value={initial} onChange={setInitial} allowNegative />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  accounts,
  today,
  open,
  onOpenChange,
}: {
  accounts: AccountWithBalance[];
  today: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { run, pending } = useRunAction();
  const [from, setFrom] = useState(accounts[0]?.id ?? "");
  const [to, setTo] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [clientId, setClientId] = useState(() => crypto.randomUUID());

  const fromAcc = accounts.find((a) => a.id === from);

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Transfer antar-akun</DialogTitle>
          <DialogDescription>Memindahkan uang tidak dihitung sebagai pemasukan atau pengeluaran.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            run(
              () =>
                saveTransaction(null, {
                  type: "transfer",
                  amount,
                  account_id: from,
                  to_account_id: to || null,
                  tx_date: date,
                  note,
                  client_id: clientId,
                }),
              {
                onSuccess: () => {
                  setAmount(0);
                  setNote("");
                  setClientId(crypto.randomUUID());
                  onOpenChange(false);
                },
                onError: (r) => setErrors(r.fieldErrors ?? {}),
              },
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Dari" htmlFor="tf-from" error={errors.account_id}>
              <NativeSelect id="tf-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Ke" htmlFor="tf-to" error={errors.to_account_id}>
              <NativeSelect id="tf-to" value={to} onChange={(e) => setTo(e.target.value)}>
                <option value="">Pilih…</option>
                {accounts
                  .filter((a) => a.id !== from)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </NativeSelect>
            </Field>
          </div>
          <Field
            label="Nominal"
            htmlFor="tf-amount"
            error={errors.amount}
            hint={fromAcc ? `Saldo ${fromAcc.name}: ${formatRupiah(fromAcc.balance)}` : undefined}
          >
            <MoneyInput id="tf-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
          </Field>
          <Field label="Tanggal" htmlFor="tf-date" error={errors.tx_date}>
            <input
              id="tf-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="tf-note" error={errors.note}>
            <Input id="tf-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="h-10" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AccountsManager({ accounts, today }: { accounts: AccountWithBalance[]; today: string }) {
  const [editing, setEditing] = useState<AccountWithBalance | null>(null);
  const [adding, setAdding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const { run, pending } = useRunAction();

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);
  const total = active.reduce((sum, a) => sum + a.balance, 0);

  return (
    <div className="grid gap-5">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div>
          <p className="text-sm text-muted-foreground">Total uang di semua akun</p>
          <p className="tabular mt-1 text-3xl font-bold tracking-tight">
            <Money value={total} tone="auto" />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Dihitung dari saldo awal + transaksi tercatat.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-xl" onClick={() => setTransferring(true)} disabled={active.length < 2}>
            <ArrowRightLeft aria-hidden /> Transfer
          </Button>
          <Button className="h-10 rounded-xl" onClick={() => setAdding(true)}>
            <Plus aria-hidden /> Tambah akun
          </Button>
        </div>
      </div>
      {active.length < 2 && active.length > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">Tambahkan akun kedua untuk memakai fitur transfer.</p>
      )}

      {active.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum ada akun aktif" description="Tambahkan akun agar bisa mencatat transaksi." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {active.map((a) => {
            const Icon = KIND_ICON[a.kind];
            return (
              <li key={a.id} className="animate-fade-up rounded-2xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">{ACCOUNT_KIND_LABELS[a.kind]}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${a.name}`} className="text-muted-foreground" onClick={() => setEditing(a)}>
                      <Pencil aria-hidden />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Arsipkan ${a.name}`}
                      className="text-muted-foreground"
                      disabled={pending}
                      onClick={() => run(() => setAccountArchived(a.id, true))}
                    >
                      <Archive aria-hidden />
                    </Button>
                    <ConfirmDeleteButton
                      ariaLabel={`Hapus ${a.name}`}
                      title={`Hapus akun ${a.name}?`}
                      description="Akun hanya bisa dihapus bila belum punya transaksi. Jika sudah punya transaksi, arsipkan saja."
                      action={() => deleteAccount(a.id)}
                    />
                  </div>
                </div>
                <p className={cn("tabular mt-4 text-2xl font-bold tracking-tight", a.balance < 0 && "text-expense")}>
                  <Money value={a.balance} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saldo awal <Money value={a.initial_balance} />
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 && (
        <section aria-label="Akun diarsipkan" className="grid gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">Diarsipkan</h2>
          <ul className="grid gap-2">
            {archived.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 rounded-2xl border border-dashed px-4 py-3">
                <span className="truncate text-sm text-muted-foreground">{a.name}</span>
                <Button variant="ghost" size="sm" className="gap-1" disabled={pending} onClick={() => run(() => setAccountArchived(a.id, false))}>
                  <ArchiveRestore aria-hidden /> Aktifkan
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* key membuat state form direset setiap kali dialog dibuka untuk akun berbeda */}
      {adding && <AccountDialog key="new" account={null} open onOpenChange={setAdding} />}
      {editing && <AccountDialog key={editing.id} account={editing} open onOpenChange={(o) => !o && setEditing(null)} />}
      {transferring && <TransferDialog accounts={active} today={today} open onOpenChange={setTransferring} />}
    </div>
  );
}
