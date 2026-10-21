import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/ui-bits";
import { TransactionForm } from "@/components/transactions/transaction-form";
import { requireUser } from "@/lib/data/auth";
import { getAccounts, getCategories, getTransactionById } from "@/lib/data/queries";
import { todayJakarta } from "@/lib/dates";
import { idSchema } from "@/lib/validation";

export const metadata: Metadata = { title: "Ubah transaksi" };

export default async function EditTransactionPage({ params }: PageProps<"/transactions/[id]/edit">) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();

  const { supabase } = await requireUser();
  const [tx, accounts, categories] = await Promise.all([
    getTransactionById(supabase, id),
    getAccounts(supabase),
    getCategories(supabase),
  ]);
  if (!tx) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader title="Ubah transaksi" description="Saldo, grafik, dan laporan ikut diperbarui otomatis." />
      <TransactionForm accounts={accounts} categories={categories} transaction={tx} today={todayJakarta()} />
    </div>
  );
}
