"use server";

import { z } from "zod";
import { fail, parseInput, success } from "@/lib/action";
import { withAuth } from "@/lib/data/auth";
import { sendTestPush } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
});

export async function savePushSubscription(input: z.infer<typeof subscriptionSchema>) {
  const parsed = parseInput(subscriptionSchema, input);
  if (!parsed.ok) return fail("Data langganan notifikasi tidak valid.");
  return withAuth(async ({ supabase, user }) => {
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert({ ...parsed.data, user_id: user.id, last_notified_key: null }, { onConflict: "endpoint" });
    if (error) return fail("Notifikasi gagal diaktifkan. Pastikan migrasi database sudah dijalankan.");
    return success("Notifikasi diaktifkan.");
  });
}

export async function removePushSubscription(endpoint: string) {
  return withAuth(async ({ supabase }) => {
    const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    if (error) return fail("Notifikasi gagal dimatikan.");
    return success("Notifikasi dimatikan.");
  });
}

export async function sendTestNotification() {
  return withAuth(async ({ supabase }) => {
    const sent = await sendTestPush(supabase);
    return sent > 0 ? success("Notifikasi tes dikirim.") : fail("Tidak ada perangkat yang bisa dikirimi notifikasi.");
  });
}
