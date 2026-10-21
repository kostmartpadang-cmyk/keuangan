"use client";

import { useState } from "react";
import { Ban, CalendarClock, ChevronDown, Info, Loader2, Pencil, Plus, RotateCcw, Target } from "lucide-react";
import { addContribution, createGoal, deleteContribution, deleteGoal, setGoalCancelled, updateGoal } from "@/actions/goals";
import { Field, MoneyInput } from "@/components/forms/fields";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete";
import { EmptyState, Money, ProgressBar } from "@/components/shared/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRunAction } from "@/hooks/use-run-action";
import { GOAL_STATUS_LABELS } from "@/lib/constants";
import { daysBetween, formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { FinancialGoal, GoalContribution } from "@/lib/types";
import { cn } from "@/lib/utils";

const dateCls =
  "h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type Errors = Record<string, string>;

function GoalDialog({ goal, onClose }: { goal: FinancialGoal | null; onClose: () => void }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(goal?.name ?? "");
  const [target, setTarget] = useState(goal?.target_amount ?? 0);
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [note, setNote] = useState(goal?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal ? "Ubah tujuan" : "Tujuan baru"}</DialogTitle>
          <DialogDescription>Mis. membeli panci listrik, pakaian, atau dana kebutuhan mendadak.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            const input = { name, target_amount: target, deadline: deadline || null, note };
            run(() => (goal ? updateGoal(goal.id, input) : createGoal(input)), {
              onSuccess: onClose,
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }}
        >
          <Field label="Nama tujuan" htmlFor="g-name" error={errors.name}>
            <Input id="g-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-10" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Target nominal" htmlFor="g-target" error={errors.target_amount}>
            <MoneyInput id="g-target" value={target} onChange={setTarget} invalid={!!errors.target_amount} />
          </Field>
          <Field label="Tenggat (opsional)" htmlFor="g-deadline" error={errors.deadline}>
            <input id="g-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={dateCls} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="g-note" error={errors.note}>
            <Textarea id="g-note" value={note} rows={2} maxLength={500} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
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

function ContributionDialog({ goal, today, onClose }: { goal: FinancialGoal; today: string; onClose: () => void }) {
  const { run, pending } = useRunAction();
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah kontribusi</DialogTitle>
          <DialogDescription>
            {goal.name}. Kontribusi hanya mencatat alokasi ke tujuan ini — saldo akun tidak berubah. Jika uangnya dipindah ke rekening
            tabungan, catat lewat Transfer di halaman Akun uang.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            run(() => addContribution({ goal_id: goal.id, amount, contributed_on: date, note }), {
              onSuccess: onClose,
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }}
        >
          <Field label="Nominal" htmlFor="c-amount" error={errors.amount}>
            <MoneyInput id="c-amount" value={amount} onChange={setAmount} autoFocus invalid={!!errors.amount} />
          </Field>
          <Field label="Tanggal" htmlFor="c-date" error={errors.contributed_on}>
            <input id="c-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={dateCls} />
          </Field>
          <Field label="Catatan (opsional)" htmlFor="c-note" error={errors.note}>
            <Input id="c-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className="h-10" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
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

function GoalCard({
  goal,
  contributions,
  today,
  onEdit,
  onContribute,
}: {
  goal: FinancialGoal;
  contributions: GoalContribution[];
  today: string;
  onEdit: () => void;
  onContribute: () => void;
}) {
  const { run, pending } = useRunAction();
  const collected = contributions.reduce((s, c) => s + c.amount, 0);
  const ratio = goal.target_amount > 0 ? collected / goal.target_amount : 0;
  const remaining = Math.max(0, goal.target_amount - collected);
  const cancelled = goal.status === "cancelled";

  let pace: string | null = null;
  if (goal.deadline && goal.status === "active" && remaining > 0) {
    const days = daysBetween(today, goal.deadline);
    if (days < 0) pace = "Tenggat sudah lewat";
    else {
      const months = Math.max(1, Math.ceil(days / 30));
      pace = `Perlu sekitar ${formatRupiah(Math.ceil(remaining / months))} per bulan`;
    }
  }

  return (
    <li className={cn("animate-fade-up rounded-2xl border bg-card p-4 sm:p-5", cancelled && "opacity-70")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{goal.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={goal.status === "achieved" ? "default" : "secondary"}>{GOAL_STATUS_LABELS[goal.status]}</Badge>
            {goal.deadline && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden /> {formatDate(goal.deadline)}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${goal.name}`} className="text-muted-foreground" onClick={onEdit}>
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={cancelled ? `Aktifkan kembali ${goal.name}` : `Batalkan ${goal.name}`}
            className="text-muted-foreground"
            disabled={pending}
            onClick={() => run(() => setGoalCancelled(goal.id, !cancelled))}
          >
            {cancelled ? <RotateCcw aria-hidden /> : <Ban aria-hidden />}
          </Button>
          <ConfirmDeleteButton
            ariaLabel={`Hapus ${goal.name}`}
            title={`Hapus tujuan ${goal.name}?`}
            description="Tujuan beserta seluruh riwayat kontribusinya akan dihapus permanen. Saldo akun tidak terpengaruh."
            action={() => deleteGoal(goal.id)}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="tabular text-xl font-bold">
            <Money value={collected} />
          </p>
          <p className="tabular text-xs text-muted-foreground">
            dari <Money value={goal.target_amount} /> · {Math.min(999, Math.round(ratio * 100))}%
          </p>
        </div>
        <ProgressBar
          ratio={ratio}
          label={`${goal.name}: ${Math.round(ratio * 100)}% terkumpul`}
          className="h-2.5"
        />
        {goal.status === "active" && (
          <p className="text-xs text-muted-foreground">
            Kurang <Money value={remaining} />
            {pace && ` · ${pace}`}
          </p>
        )}
      </div>

      {goal.note && <p className="mt-3 text-sm text-muted-foreground">{goal.note}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button className="h-9 rounded-xl" onClick={onContribute} disabled={cancelled}>
          <Plus aria-hidden /> Kontribusi
        </Button>
      </div>

      <details className="group mt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
          Riwayat kontribusi ({contributions.length})
        </summary>
        {contributions.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Belum ada kontribusi.</p>
        ) : (
          <ul className="mt-2 divide-y">
            {contributions.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <Money value={c.amount} tone="income" signed />
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDate(c.contributed_on)}
                    {c.note ? ` · ${c.note}` : ""}
                  </p>
                </div>
                <ConfirmDeleteButton
                  ariaLabel="Hapus kontribusi"
                  title="Hapus kontribusi ini?"
                  description="Jumlah terkumpul pada tujuan akan dihitung ulang."
                  action={() => deleteContribution(c.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </details>
    </li>
  );
}

export function GoalsManager({
  goals,
  contributions,
  today,
}: {
  goals: FinancialGoal[];
  contributions: GoalContribution[];
  today: string;
}) {
  const [dialog, setDialog] = useState<{ kind: "goal"; goal: FinancialGoal | null } | { kind: "contribute"; goal: FinancialGoal } | null>(null);

  const byGoal = new Map<string, GoalContribution[]>();
  for (const c of contributions) byGoal.set(c.goal_id, [...(byGoal.get(c.goal_id) ?? []), c]);

  const sections = (["active", "achieved", "cancelled"] as const)
    .map((status) => ({ status, items: goals.filter((g) => g.status === status) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground sm:max-w-xl">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Kontribusi hanya mencatat uang yang Anda sisihkan untuk tujuan ini. Saldo akun tidak berkurang, sehingga tidak ada pengeluaran ganda.
        </p>
        <Button className="h-10 rounded-xl" onClick={() => setDialog({ kind: "goal", goal: null })}>
          <Plus aria-hidden /> Tujuan baru
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="Belum ada tujuan keuangan"
          description="Buat tujuan untuk barang atau kebutuhan yang ingin Anda tabung, lalu catat kontribusinya secara berkala."
          action={
            <Button className="h-10 rounded-xl" onClick={() => setDialog({ kind: "goal", goal: null })}>
              <Plus aria-hidden /> Buat tujuan pertama
            </Button>
          }
        />
      ) : (
        sections.map(({ status, items }) => (
          <section key={status} aria-label={GOAL_STATUS_LABELS[status]} className="grid gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {GOAL_STATUS_LABELS[status]} ({items.length})
            </h2>
            <ul className="grid gap-3 lg:grid-cols-2">
              {items.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  contributions={byGoal.get(g.id) ?? []}
                  today={today}
                  onEdit={() => setDialog({ kind: "goal", goal: g })}
                  onContribute={() => setDialog({ kind: "contribute", goal: g })}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      {dialog?.kind === "goal" && <GoalDialog key={dialog.goal?.id ?? "new"} goal={dialog.goal} onClose={() => setDialog(null)} />}
      {dialog?.kind === "contribute" && <ContributionDialog key={dialog.goal.id} goal={dialog.goal} today={today} onClose={() => setDialog(null)} />}
    </div>
  );
}
