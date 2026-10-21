import { NextResponse, type NextRequest } from "next/server";
import { toCsv } from "@/lib/csv";
import { PAYMENT_METHOD_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { getAccounts, getCategories, getFullTransactionsInRange } from "@/lib/data/queries";
import { isValidISODate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/** Ekspor transaksi milik pengguna yang sedang login (RLS membatasi baris). ?from=&to= opsional. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const fromRaw = sp.get("from");
  const toRaw = sp.get("to");
  const from = fromRaw && isValidISODate(fromRaw) ? fromRaw : undefined;
  const to = toRaw && isValidISODate(toRaw) ? toRaw : undefined;

  const [txs, accounts, categories] = await Promise.all([
    getFullTransactionsInRange(supabase, from, to),
    getAccounts(supabase),
    getCategories(supabase),
  ]);
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  const csv = toCsv(
    ["Tanggal", "Tipe", "Kategori", "Nominal (Rp)", "Metode pembayaran", "Akun", "Akun tujuan", "Catatan", "Hitung anggaran mingguan", "Hitung anggaran bulanan"],
    txs.map((t) => [
      t.tx_date,
      TRANSACTION_TYPE_LABELS[t.type],
      t.category_id ? (categoryName.get(t.category_id) ?? "") : "",
      t.amount,
      t.payment_method ? PAYMENT_METHOD_LABELS[t.payment_method] : "",
      accountName.get(t.account_id) ?? "",
      t.to_account_id ? (accountName.get(t.to_account_id) ?? "") : "",
      t.note ?? "",
      t.type === "expense" ? (t.count_weekly ? "Ya" : "Tidak") : "",
      t.type === "expense" ? (t.count_monthly ? "Ya" : "Tidak") : "",
    ]),
  );

  const name = `ruanguang-transaksi${from ? `-${from}` : ""}${to ? `_${to}` : ""}${!from && !to ? "-semua" : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
