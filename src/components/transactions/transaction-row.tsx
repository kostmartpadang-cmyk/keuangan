import Link from "next/link";
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Pencil } from "lucide-react";
import { DeleteTransactionButton } from "@/components/transactions/delete-transaction-button";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatRupiah } from "@/lib/money";
import type { Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON = {
  income: { Icon: ArrowDownLeft, cls: "bg-income-soft text-income" },
  expense: { Icon: ArrowUpRight, cls: "bg-expense-soft text-expense" },
  transfer: { Icon: ArrowRightLeft, cls: "bg-muted text-muted-foreground" },
} as const;

export function TransactionRow({
  tx,
  categoryName,
  accountNames,
  actions = true,
}: {
  tx: Transaction;
  categoryName: string;
  accountNames: Map<string, string>;
  actions?: boolean;
}) {
  const { Icon, cls } = ICON[tx.type];
  const from = accountNames.get(tx.account_id) ?? "Akun";
  const to = tx.to_account_id ? (accountNames.get(tx.to_account_id) ?? "Akun") : null;

  const title = tx.type === "transfer" ? `Transfer ${from} → ${to}` : categoryName;
  const meta = [
    formatDate(tx.tx_date),
    tx.type === "transfer" ? null : `${from}${tx.payment_method ? ` · ${PAYMENT_METHOD_LABELS[tx.payment_method]}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", cls)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
        {tx.note && <p className="truncate text-xs text-muted-foreground/80">{tx.note}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-center sm:gap-3">
        <p
          className={cn(
            "tabular text-sm font-bold whitespace-nowrap",
            tx.type === "income" && "text-income",
            tx.type === "expense" && "text-expense",
          )}
        >
          {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
          {formatRupiah(tx.amount)}
        </p>
        {actions && (
          <div className="flex">
            <Button
              render={<Link href={`/transactions/${tx.id}/edit`} />}
              nativeButton={false}
              variant="ghost"
              size="icon-sm"
              aria-label="Ubah transaksi"
              className="text-muted-foreground"
            >
              <Pencil aria-hidden />
            </Button>
            <DeleteTransactionButton id={tx.id} summary={`${title} sebesar ${formatRupiah(tx.amount)} pada ${formatDate(tx.tx_date)}`} />
          </div>
        )}
      </div>
    </li>
  );
}
