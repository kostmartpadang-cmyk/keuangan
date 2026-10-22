"use client";

import { useState } from "react";
import { CopyPlus, Loader2, Pencil, Plus, Sparkles, WalletCards, Wand2 } from "lucide-react";
import { applyPlanTemplate, autoGeneratePlan, copyPlanFromPreviousMonth, deletePlanItem, savePlanItem, savePlanSalary } from "@/actions/planning";
import { Field, MoneyInput, NativeSelect } from "@/components/forms/fields";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete";
import { EmptyState, Money, SectionCard } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/hooks/use-run-action";
import type { Category, PlanItemKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PlanItemView {
  id: string;
  name: string;
  kind: PlanItemKind;
  category_id: string | null;
  amount: number;
  /** Pengeluaran aktual pada kategori terkait; null bila pos tidak ditautkan ke kategori. */
  actual: number | null;
}

function ItemDialog({
  month,
  item,
  categories,
  onClose,
}: {
  month: string;
  item: PlanItemView | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(item?.name ?? "");
  const [kind, setKind] = useState<PlanItemKind>(item?.kind ?? "budget");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [amount, setAmount] = useState(item?.amount ?? 0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? "Ubah pos" : "Tambah pos"}</DialogTitle>
          <DialogDescription>Tautkan ke kategori agar pengeluaran aktual bisa dibandingkan dengan rencana.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setErrors({});
            run(() => savePlanItem(month, item?.id ?? null, { name, kind, category_id: categoryId || null, amount }), {
              onSuccess: onClose,
              onError: (r) => setErrors(r.fieldErrors ?? {}),
            });
          }}
        >
          <Field label="Nama pos" htmlFor="pi-name" error={errors.name}>
            <Input id="pi-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} className="h-10" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Jenis" htmlFor="pi-kind">
            <NativeSelect id="pi-kind" value={kind} onChange={(e) => setKind(e.target.value as PlanItemKind)}>
              <option value="fixed">Biaya tetap</option>
              <option value="budget">Anggaran</option>
            </NativeSelect>
          </Field>
          <Field label="Kategori pengeluaran (opsional)" htmlFor="pi-cat">
            <NativeSelect id="pi-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Tidak ditautkan</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Nominal rencana" htmlFor="pi-amount" error={errors.amount}>
            <MoneyInput id="pi-amount" value={amount} onChange={setAmount} invalid={!!errors.amount} />
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

function SalaryForm({ month, salary }: { month: string; salary: number }) {
  const { run, pending } = useRunAction();
  const [value, setValue] = useState(salary);
  const [error, setError] = useState<string>();

  return (
    <form
      noValidate
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        run(() => savePlanSalary(month, value), { onError: (r) => setError(r.fieldErrors?.salary ?? r.error) });
      }}
    >
      <Field label="Perkiraan gaji (cadangan)" htmlFor="salary" error={error} className="min-w-52 flex-1">
        <MoneyInput id="salary" value={value} onChange={setValue} invalid={!!error} />
      </Field>
      <Button type="submit" className="h-12 rounded-xl sm:h-10" disabled={pending || value === salary}>
        {pending && <Loader2 className="animate-spin" aria-hidden />} Simpan gaji
      </Button>
    </form>
  );
}

export function PlanEditor({
  month,
  salary,
  recordedSalary,
  items,
  categories,
  canCopyPrevious,
}: {
  month: string;
  salary: number;
  /** Total transaksi pemasukan kategori Gaji pada bulan ini. */
  recordedSalary: number;
  items: PlanItemView[];
  categories: Category[];
  canCopyPrevious: boolean;
}) {
  const [editing, setEditing] = useState<PlanItemView | "new" | null>(null);
  const { run, pending } = useRunAction();

  const groups: { kind: PlanItemKind; title: string }[] = [
    { kind: "fixed", title: "Biaya tetap" },
    { kind: "budget", title: "Anggaran" },
  ];

  return (
    <div className="grid gap-5">
      <SectionCard
        title="Gaji"
        description={
          recordedSalary > 0
            ? "Otomatis mengikuti transaksi pemasukan kategori Gaji bulan ini."
            : "Belum ada transaksi Gaji bulan ini, jadi perkiraan di bawah dipakai. Begitu Anda mencatat pemasukan Gaji, angkanya otomatis menggantikan."
        }
      >
        {recordedSalary > 0 && (
          <p className="mb-4 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-income-soft px-3 py-2 text-sm">
            <span className="text-income">Gaji tercatat bulan ini</span>
            <Money value={recordedSalary} className="font-bold text-income" />
          </p>
        )}
        {/* key: form di-remount ketika gaji tersimpan berubah dari server */}
        <SalaryForm key={`${month}-${salary}`} month={month} salary={salary} />
      </SectionCard>

      <SectionCard
        title="Pos rencana"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" className="gap-1" disabled={pending} onClick={() => run(() => autoGeneratePlan(month))}>
              <Wand2 aria-hidden /> Buat otomatis
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setEditing("new")}>
              <Plus aria-hidden /> Tambah pos
            </Button>
          </div>
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title="Belum ada pos rencana"
            description="Buat otomatis dari riwayat pengeluaran Anda, atau tambah pos satu per satu secara manual."
            className="border-0 py-6"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button className="rounded-xl" disabled={pending} onClick={() => run(() => autoGeneratePlan(month))}>
                  <Wand2 aria-hidden /> Buat otomatis
                </Button>
                <Button variant="outline" className="rounded-xl" disabled={pending} onClick={() => run(() => applyPlanTemplate(month))}>
                  <Sparkles aria-hidden /> Pos umum (kosong)
                </Button>
                {canCopyPrevious && (
                  <Button variant="outline" className="rounded-xl" disabled={pending} onClick={() => run(() => copyPlanFromPreviousMonth(month))}>
                    <CopyPlus aria-hidden /> Salin dari bulan lalu
                  </Button>
                )}
              </div>
            }
          />
        ) : (
          <div className="grid gap-5">
            {groups.map(({ kind, title }) => {
              const rows = items.filter((i) => i.kind === kind);
              if (rows.length === 0) return null;
              return (
                <div key={kind}>
                  <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
                  <ul className="divide-y">
                    {rows.map((i) => {
                      const over = i.actual !== null && i.amount > 0 && i.actual > i.amount;
                      return (
                        <li key={i.id} className="flex items-center gap-2 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{i.name}</p>
                            <p className="tabular text-xs text-muted-foreground">
                              {i.actual === null ? (
                                "Tidak ditautkan ke kategori"
                              ) : (
                                <>
                                  Aktual <Money value={i.actual} className={cn(over && "font-semibold text-expense")} />
                                </>
                              )}
                            </p>
                          </div>
                          <Money value={i.amount} className="text-sm font-bold" />
                          <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${i.name}`} className="text-muted-foreground" onClick={() => setEditing(i)}>
                            <Pencil aria-hidden />
                          </Button>
                          <ConfirmDeleteButton
                            ariaLabel={`Hapus ${i.name}`}
                            title={`Hapus pos ${i.name}?`}
                            description="Pos ini dihapus dari rencana bulan ini. Transaksi Anda tidak terpengaruh."
                            action={() => deletePlanItem(i.id)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {editing && (
        <ItemDialog
          key={editing === "new" ? "new" : editing.id}
          month={month}
          item={editing === "new" ? null : editing}
          categories={categories}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
