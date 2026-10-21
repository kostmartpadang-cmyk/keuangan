-- Hak akses eksplisit untuk pengguna login. Keamanan data tetap dijaga RLS (user_id = auth.uid()).
-- Diperlukan di project Supabase yang tidak lagi memberi grant otomatis pada tabel baru.
-- Aman dijalankan berulang.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.accounts,
  public.categories,
  public.transactions,
  public.budgets,
  public.financial_plans,
  public.plan_items,
  public.financial_goals,
  public.goal_contributions
to authenticated;

grant select on public.account_balances to authenticated;
grant execute on function public.bootstrap_current_user() to authenticated;

-- Pengguna anonim tidak boleh mengakses apa pun.
revoke all on
  public.profiles, public.accounts, public.categories, public.transactions, public.budgets,
  public.financial_plans, public.plan_items, public.financial_goals, public.goal_contributions,
  public.account_balances
from anon;
