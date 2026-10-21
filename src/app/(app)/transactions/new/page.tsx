import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/shared/ui-bits";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/data/auth";
import { getAccounts, getCategories } from "@/lib/data/queries";
import { todayJakarta } from "@/lib/dates";
import { first } from "@/lib/url";

export const metadata: Metadata = { title: "Tambah transaksi" };

export default async function NewTransactionPage({ searchParams }: PageProps<"/transactions/new">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [accounts, categories] = await Promise.all([getAccounts(supabase), getCategories(supabase)]);
  const active = accounts.filter((a) => !a.is_archived);

  const t = first(sp.type);
  const defaultType = t === "income" || t === "transfer" ? t : "expense";

  return (
    <div className="grid gap-5">
      <PageHeader title="Tambah transaksi" description="Catat pemasukan, pengeluaran, atau transfer antar-akun." />
      {active.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Belum ada akun uang"
          description="Buat minimal satu akun (mis. Tunai) sebelum mencatat transaksi."
          action={
            <Button render={<Link href="/accounts" />} nativeButton={false} className="h-10 rounded-xl">
              Kelola akun
            </Button>
          }
        />
      ) : (
        <TransactionForm accounts={accounts} categories={categories} defaultType={defaultType} today={todayJakarta()} />
      )}
    </div>
  );
}
