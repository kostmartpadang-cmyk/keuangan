import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, ReceiptText, SearchX } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/ui-bits";
import { TransactionFilters } from "@/components/transactions/transaction-filters";
import { TransactionRow } from "@/components/transactions/transaction-row";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/auth";
import { getAccounts, getCategories, listTransactions, type TransactionSort } from "@/lib/data/queries";
import { isValidISODate } from "@/lib/dates";
import { buildQuery, first } from "@/lib/url";

export const metadata: Metadata = { title: "Transaksi" };

const SORTS: TransactionSort[] = ["date_desc", "date_asc", "amount_desc", "amount_asc"];

export default async function TransactionsPage({ searchParams }: PageProps<"/transactions">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const q = first(sp.q)?.slice(0, 100);
  const typeRaw = first(sp.type);
  const type = typeRaw === "income" || typeRaw === "expense" || typeRaw === "transfer" ? typeRaw : undefined;
  const category = first(sp.category) || undefined;
  const account = first(sp.account) || undefined;
  const fromRaw = first(sp.from);
  const toRaw = first(sp.to);
  const from = fromRaw && isValidISODate(fromRaw) ? fromRaw : undefined;
  const to = toRaw && isValidISODate(toRaw) ? toRaw : undefined;
  const sortRaw = first(sp.sort) as TransactionSort | undefined;
  const sort = sortRaw && SORTS.includes(sortRaw) ? sortRaw : "date_desc";
  const page = Math.max(1, Number(first(sp.page)) || 1);

  const [{ rows, count, pageSize }, accounts, categories] = await Promise.all([
    listTransactions(supabase, { q, type, categoryId: category, accountId: account, from, to, sort, page }),
    getAccounts(supabase),
    getCategories(supabase),
  ]);

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const filtered = Boolean(q || type || category || account || from || to);
  const base = { q, type, category, account, from, to, sort: sort === "date_desc" ? undefined : sort };

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Transaksi"
        description={count > 0 ? `${count} transaksi${filtered ? " sesuai filter" : ""}` : undefined}
        actions={
          <Button render={<Link href="/transactions/new" />} nativeButton={false} className="hidden h-10 rounded-xl md:inline-flex">
            <Plus aria-hidden /> Tambah
          </Button>
        }
      />

      <TransactionFilters
        values={{ q, type, category, account, from, to, sort }}
        categories={categories}
        accounts={accounts}
      />

      {rows.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="Tidak ada transaksi yang cocok"
            description="Coba ubah kata kunci atau longgarkan filter yang dipakai."
          />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title="Belum ada transaksi"
            description="Catat pemasukan atau pengeluaran pertama Anda. Saldo, grafik, dan laporan akan terisi otomatis."
            action={
              <Button render={<Link href="/transactions/new" />} nativeButton={false} className="h-10 rounded-xl">
                <Plus aria-hidden /> Catat transaksi pertama
              </Button>
            }
          />
        )
      ) : (
        <div className="rounded-2xl border bg-card px-4">
          <ul className="divide-y">
            {rows.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                categoryName={(tx.category_id && categoryNames.get(tx.category_id)) || "Tanpa kategori"}
                accountNames={accountNames}
              />
            ))}
          </ul>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Halaman" className="flex items-center justify-between gap-3">
          <Button
            render={<Link href={`/transactions${buildQuery({ ...base, page: page - 1 })}`} />}
            nativeButton={false}
            variant="outline"
            className="h-10 rounded-xl"
            disabled={page <= 1}
            aria-disabled={page <= 1}
          >
            <ChevronLeft aria-hidden /> Sebelumnya
          </Button>
          <span className="text-sm text-muted-foreground">
            Halaman {Math.min(page, totalPages)} dari {totalPages}
          </span>
          <Button
            render={<Link href={`/transactions${buildQuery({ ...base, page: page + 1 })}`} />}
            nativeButton={false}
            variant="outline"
            className="h-10 rounded-xl"
            disabled={page >= totalPages}
            aria-disabled={page >= totalPages}
          >
            Berikutnya <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  );
}
