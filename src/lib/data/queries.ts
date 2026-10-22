import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PAGE_SIZE } from "@/lib/constants";
import type {
  AccountWithBalance,
  Budget,
  Category,
  FinancialGoal,
  FinancialPlan,
  GoalContribution,
  PlanItem,
  Transaction,
  TransactionLite,
} from "@/lib/types";

const TX_COLUMNS =
  "id, type, amount, category_id, account_id, to_account_id, tx_date, payment_method, note, count_weekly, count_monthly, created_at";
const TX_LITE_COLUMNS = "id, type, amount, category_id, account_id, to_account_id, tx_date, count_weekly, count_monthly";

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** PostgREST membatasi 1000 baris per permintaan; ambil semua halaman agar agregasi akurat. */
export async function fetchAll<T>(build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return out;
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }, fallback: T): T {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? fallback;
}

export async function getAccounts(supabase: SupabaseClient): Promise<AccountWithBalance[]> {
  const res = await supabase
    .from("account_balances")
    .select("id, name, kind, initial_balance, is_archived, sort_order, balance")
    .order("sort_order")
    .order("name");
  return unwrap(res, []) as AccountWithBalance[];
}

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const res = await supabase
    .from("categories")
    .select("id, name, type, sort_order, default_amount")
    .order("type")
    .order("sort_order")
    .order("name");
  return unwrap(res, []) as Category[];
}

/** Transaksi ringan (untuk agregasi) pada rentang tanggal inklusif. */
export async function getTransactionsInRange(
  supabase: SupabaseClient,
  from: string,
  to: string,
): Promise<TransactionLite[]> {
  return fetchAll<TransactionLite>((a, b) =>
    supabase
      .from("transactions")
      .select(TX_LITE_COLUMNS)
      .gte("tx_date", from)
      .lte("tx_date", to)
      .order("tx_date")
      .order("created_at")
      .order("id")
      .range(a, b),
  );
}

export async function getRecentTransactions(supabase: SupabaseClient, limit: number): Promise<Transaction[]> {
  const res = await supabase
    .from("transactions")
    .select(TX_COLUMNS)
    .order("tx_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return unwrap(res, []) as Transaction[];
}

export async function getTransactionById(supabase: SupabaseClient, id: string): Promise<Transaction | null> {
  const res = await supabase.from("transactions").select(TX_COLUMNS).eq("id", id).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as Transaction | null) ?? null;
}

export type TransactionSort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export interface TransactionFilters {
  q?: string;
  type?: "income" | "expense" | "transfer";
  categoryId?: string;
  accountId?: string;
  from?: string;
  to?: string;
  sort?: TransactionSort;
  page?: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listTransactions(
  supabase: SupabaseClient,
  f: TransactionFilters,
): Promise<{ rows: Transaction[]; count: number; pageSize: number }> {
  const page = Math.max(1, f.page ?? 1);
  let query = supabase.from("transactions").select(TX_COLUMNS, { count: "exact" });

  if (f.q?.trim()) query = query.ilike("note", `%${escapeLike(f.q.trim())}%`);
  if (f.type) query = query.eq("type", f.type);
  if (f.categoryId) query = query.eq("category_id", f.categoryId);
  // accountId disisipkan ke string filter PostgREST, jadi wajib UUID valid.
  if (f.accountId && UUID_RE.test(f.accountId)) query = query.or(`account_id.eq.${f.accountId},to_account_id.eq.${f.accountId}`);
  if (f.from) query = query.gte("tx_date", f.from);
  if (f.to) query = query.lte("tx_date", f.to);

  switch (f.sort) {
    case "date_asc":
      query = query.order("tx_date").order("created_at");
      break;
    case "amount_desc":
      query = query.order("amount", { ascending: false }).order("tx_date", { ascending: false });
      break;
    case "amount_asc":
      query = query.order("amount").order("tx_date", { ascending: false });
      break;
    default:
      query = query.order("tx_date", { ascending: false }).order("created_at", { ascending: false });
  }
  query = query.order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Transaction[], count: count ?? 0, pageSize: PAGE_SIZE };
}

/** Seluruh transaksi lengkap pada rentang (untuk laporan & ekspor CSV). */
export async function getFullTransactionsInRange(
  supabase: SupabaseClient,
  from?: string,
  to?: string,
): Promise<Transaction[]> {
  return fetchAll<Transaction>((a, b) => {
    let q = supabase.from("transactions").select(TX_COLUMNS);
    if (from) q = q.gte("tx_date", from);
    if (to) q = q.lte("tx_date", to);
    return q
      .order("tx_date", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b);
  });
}

export async function getBudgets(supabase: SupabaseClient): Promise<Budget[]> {
  const res = await supabase
    .from("budgets")
    .select("id, period_type, category_id, period_start, amount")
    .order("period_start", { ascending: false });
  return unwrap(res, []) as Budget[];
}

/** Rencana bulanan beserta pos-posnya dalam satu permintaan (relasi plan_items di-embed). */
export async function getPlan(
  supabase: SupabaseClient,
  month: string,
): Promise<{ plan: FinancialPlan | null; items: PlanItem[] }> {
  const res = await supabase
    .from("financial_plans")
    .select("id, month, salary, plan_items(id, plan_id, name, kind, category_id, amount, sort_order, created_at)")
    .eq("month", month)
    .maybeSingle();
  if (res.error) throw new Error(res.error.message);
  if (!res.data) return { plan: null, items: [] };

  const { plan_items, ...plan } = res.data as FinancialPlan & { plan_items: (PlanItem & { created_at: string })[] };
  const items = [...(plan_items ?? [])].sort(
    (x, y) =>
      x.kind.localeCompare(y.kind) || x.sort_order - y.sort_order || x.created_at.localeCompare(y.created_at),
  );
  return { plan, items };
}

/** Apakah rencana bulan tertentu sudah ada (tanpa memuat pos-posnya). */
export async function hasPlan(supabase: SupabaseClient, month: string): Promise<boolean> {
  const res = await supabase.from("financial_plans").select("id", { count: "exact", head: true }).eq("month", month);
  if (res.error) throw new Error(res.error.message);
  return (res.count ?? 0) > 0;
}

export async function getGoals(
  supabase: SupabaseClient,
): Promise<{ goals: FinancialGoal[]; contributions: GoalContribution[] }> {
  const [goalsRes, contribs] = await Promise.all([
    supabase
      .from("financial_goals")
      .select("id, name, target_amount, deadline, note, status, created_at")
      .order("created_at", { ascending: false }),
    fetchAll<GoalContribution>((a, b) =>
      supabase
        .from("goal_contributions")
        .select("id, goal_id, amount, contributed_on, note")
        .order("contributed_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, b),
    ),
  ]);
  return { goals: unwrap(goalsRes, []) as FinancialGoal[], contributions: contribs };
}
