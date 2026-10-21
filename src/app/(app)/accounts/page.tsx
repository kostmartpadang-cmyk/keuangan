import type { Metadata } from "next";
import { AccountsManager } from "@/components/accounts/accounts-manager";
import { PageHeader } from "@/components/shared/ui-bits";
import { requireUser } from "@/lib/data/auth";
import { getAccounts } from "@/lib/data/queries";
import { todayJakarta } from "@/lib/dates";

export const metadata: Metadata = { title: "Akun uang" };

export default async function AccountsPage() {
  const { supabase } = await requireUser();
  const accounts = await getAccounts(supabase);

  return (
    <div className="grid gap-5">
      <PageHeader title="Akun uang" description="Pisahkan uang tunai dan uang di QRIS/rekening. Saldo dihitung otomatis dari transaksi." />
      <AccountsManager accounts={accounts} today={todayJakarta()} />
    </div>
  );
}
