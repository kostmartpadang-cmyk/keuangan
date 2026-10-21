"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { setBudget } from "@/actions/budgets";
import { Field, MoneyInput } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRunAction } from "@/hooks/use-run-action";
import type { BudgetPeriodType } from "@/lib/types";

export function SetBudgetButton({
  periodType,
  categoryId,
  title,
  currentLimit,
  variant = "ghost",
}: {
  periodType: BudgetPeriodType;
  categoryId: string | null;
  title: string;
  currentLimit: number;
  variant?: "ghost" | "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(currentLimit);
  const [error, setError] = useState<string>();
  const { run, pending } = useRunAction();
  const periodName = periodType === "weekly" ? "mingguan" : "bulanan";
  const hasLimit = currentLimit > 0;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        className="gap-1"
        aria-label={`${hasLimit ? "Ubah" : "Atur"} batas ${periodName} ${title}`}
        onClick={() => {
          setAmount(currentLimit);
          setError(undefined);
          setOpen(true);
        }}
      >
        {hasLimit ? <Pencil aria-hidden /> : <Plus aria-hidden />}
        {hasLimit ? "Ubah" : "Atur"}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Batas {periodName}: {title}
            </DialogTitle>
            <DialogDescription>
              Berlaku mulai periode {periodType === "weekly" ? "minggu" : "bulan"} ini dan seterusnya sampai Anda mengubahnya. Isi 0 untuk
              menghapus batas.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError(undefined);
              run(() => setBudget({ period_type: periodType, category_id: categoryId, amount }), {
                onSuccess: () => setOpen(false),
                onError: (r) => setError(r.fieldErrors?.amount ?? r.error),
              });
            }}
          >
            <Field label="Batas pengeluaran" htmlFor="budget-amount" error={error}>
              <MoneyInput id="budget-amount" value={amount} onChange={setAmount} autoFocus invalid={!!error} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" aria-hidden />} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
