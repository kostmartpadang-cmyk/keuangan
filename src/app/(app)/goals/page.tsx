import type { Metadata } from "next";
import { GoalsManager } from "@/components/goals/goals-manager";
import { PageHeader } from "@/components/shared/ui-bits";
import { requireUser } from "@/lib/data/auth";
import { getGoals } from "@/lib/data/queries";
import { todayJakarta } from "@/lib/dates";

export const metadata: Metadata = { title: "Tujuan keuangan" };

export default async function GoalsPage() {
  const { supabase } = await requireUser();
  const { goals, contributions } = await getGoals(supabase);

  return (
    <div className="grid gap-5">
      <PageHeader title="Tujuan keuangan" description="Rencanakan pembelian barang atau dana kebutuhan, dan pantau progresnya." />
      <GoalsManager goals={goals} contributions={contributions} today={todayJakarta()} />
    </div>
  );
}
