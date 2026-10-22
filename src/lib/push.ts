import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { BUDGET_LOW_REMAINING_RATIO } from "@/lib/constants";
import { getPeriodPrefs } from "@/lib/data/auth";
import { getBudgets, getTransactionsInRange } from "@/lib/data/queries";
import { todayJakarta } from "@/lib/dates";
import { budgetStatus, periodEndOf, periodStartOf, resolveLimit, spentInPeriod } from "@/lib/finance/budgets";
import { formatRupiah } from "@/lib/money";

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_notified_key: string | null;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/** Kirim ke langganan; langganan yang sudah tidak berlaku (404/410) dihapus. Mengembalikan jumlah terkirim. */
async function deliver(supabase: SupabaseClient, subs: SubRow[], payload: PushPayload): Promise<number> {
  let sent = 0;
  const dead: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) dead.push(s.id);
        else console.error("[push]", status ?? error);
      }
    }),
  );
  if (dead.length) await supabase.from("push_subscriptions").delete().in("id", dead);
  return sent;
}

async function listSubs(supabase: SupabaseClient): Promise<SubRow[]> {
  const { data } = await supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth, last_notified_key");
  return (data ?? []) as SubRow[];
}

export async function sendTestPush(supabase: SupabaseClient): Promise<number> {
  if (!configure()) return 0;
  return deliver(supabase, await listSubs(supabase), {
    title: "RuangUang",
    body: "Notifikasi berhasil diaktifkan di perangkat ini.",
    url: "/dashboard",
    tag: "test",
  });
}

/** Kirim notifikasi bila sisa anggaran mingguan ≤ 10% (atau terlampaui); satu kali per minggu per tingkat. */
export async function notifyWeeklyBudgetIfLow(supabase: SupabaseClient, userId: string): Promise<void> {
  if (!configure()) return;
  const subs = await listSubs(supabase);
  if (subs.length === 0) return;

  const today = todayJakarta();
  const { weekStartDay } = await getPeriodPrefs(supabase, userId);
  const start = periodStartOf("weekly", today, 1, weekStartDay);
  const end = periodEndOf("weekly", start, 1, weekStartDay);
  const [budgets, txs] = await Promise.all([getBudgets(supabase), getTransactionsInRange(supabase, start, end)]);
  const status = budgetStatus(spentInPeriod(txs, "weekly", null, start, end), resolveLimit(budgets, "weekly", null, start));
  if (status.limit <= 0) return;

  const over = status.remaining < 0;
  const low = !over && status.remaining <= status.limit * BUDGET_LOW_REMAINING_RATIO;
  if (!over && !low) return;

  const key = `${start}:${over ? "over" : "low"}`;
  const pending = subs.filter((s) => s.last_notified_key !== key);
  if (pending.length === 0) return;

  const pct = Math.max(0, Math.round((status.remaining / status.limit) * 100));
  const payload: PushPayload = over
    ? {
        title: "Anggaran mingguan terlampaui",
        body: `Pengeluaran minggu ini ${formatRupiah(status.spent)} melebihi batas ${formatRupiah(status.limit)}.`,
        url: "/budgets",
        tag: "weekly-budget",
      }
    : {
        title: "Sisa anggaran mingguan tinggal " + pct + "%",
        body: `Sisa ${formatRupiah(status.remaining)} dari batas ${formatRupiah(status.limit)} minggu ini.`,
        url: "/budgets",
        tag: "weekly-budget",
      };

  await deliver(supabase, pending, payload);
  await supabase.from("push_subscriptions").update({ last_notified_key: key }).in("id", pending.map((s) => s.id));
}
