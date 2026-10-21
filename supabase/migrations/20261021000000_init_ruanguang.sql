-- RuangUang — skema awal
-- Jalankan seluruh file ini di Supabase (SQL Editor atau `supabase db push`).
-- Semua nominal disimpan sebagai bilangan bulat dalam Rupiah (bigint), bukan floating point.

-- ---------------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 100),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- accounts (akun uang: tunai, QRIS/rekening, dst.)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  kind             text not null default 'bank' check (kind in ('cash', 'bank', 'other')),
  initial_balance  bigint not null default 0,
  is_archived      boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id)  -- target foreign key komposit agar relasi selalu satu pemilik
);
create unique index accounts_user_name_uq on public.accounts (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  type        text not null check (type in ('income', 'expense')),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, id)
);
create unique index categories_user_type_name_uq on public.categories (user_id, type, lower(name));

-- ---------------------------------------------------------------------------
-- transactions
--   type = income | expense | transfer
--   Transfer disimpan sebagai SATU baris (account_id -> to_account_id) sehingga
--   atomik dan tidak pernah dihitung sebagai pemasukan/pengeluaran.
-- ---------------------------------------------------------------------------
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            text not null check (type in ('income', 'expense', 'transfer')),
  amount          bigint not null check (amount > 0),
  category_id     uuid,
  account_id      uuid not null,
  to_account_id   uuid,
  tx_date         date not null,
  payment_method  text check (payment_method in ('cash', 'qris_bank')),
  note            text check (note is null or char_length(note) <= 500),
  count_weekly    boolean not null default true,
  count_monthly   boolean not null default true,
  client_id       uuid,  -- kunci idempotensi dari klien, mencegah transaksi ganda saat kirim ulang
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  foreign key (user_id, account_id)    references public.accounts   (user_id, id) on delete restrict,
  foreign key (user_id, to_account_id) references public.accounts   (user_id, id) on delete restrict,
  foreign key (user_id, category_id)   references public.categories (user_id, id) on delete restrict,
  constraint transactions_shape check (
    (
      type = 'transfer'
      and to_account_id is not null
      and to_account_id <> account_id
      and category_id is null
      and payment_method is null
    )
    or (
      type <> 'transfer'
      and to_account_id is null
      and category_id is not null
      and payment_method is not null
    )
  )
);
create unique index transactions_client_id_uq on public.transactions (user_id, client_id) where client_id is not null;
create index transactions_user_date_idx     on public.transactions (user_id, tx_date desc, created_at desc);
create index transactions_user_cat_idx      on public.transactions (user_id, category_id, tx_date);
create index transactions_user_account_idx  on public.transactions (user_id, account_id, tx_date);
create index transactions_user_toaccount_idx on public.transactions (user_id, to_account_id) where to_account_id is not null;
create index transactions_user_type_date_idx on public.transactions (user_id, type, tx_date);

-- Tipe kategori harus cocok dengan tipe transaksi (income <-> kategori pemasukan).
create or replace function public.check_transaction_category_type()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type text;
begin
  if new.type = 'transfer' then
    return new;
  end if;
  select c.type into v_type from public.categories c where c.id = new.category_id and c.user_id = new.user_id;
  if v_type is distinct from new.type then
    raise exception 'Kategori tidak sesuai dengan tipe transaksi' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_category_type
  before insert or update of type, category_id on public.transactions
  for each row execute function public.check_transaction_category_type();

-- ---------------------------------------------------------------------------
-- budgets
--   Batas berlaku sejak period_start (Senin untuk mingguan, tanggal 1 untuk
--   bulanan) sampai ada baris yang lebih baru. amount = 0 berarti "tanpa batas".
--   category_id NULL = anggaran total.
-- ---------------------------------------------------------------------------
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  period_type   text not null check (period_type in ('weekly', 'monthly')),
  category_id   uuid,
  period_start  date not null,
  amount        bigint not null check (amount >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete cascade,
  constraint budgets_period_start_valid check (
    (period_type = 'weekly'  and extract(isodow from period_start) = 1)
    or (period_type = 'monthly' and extract(day from period_start) = 1)
  )
);
create unique index budgets_total_uq on public.budgets (user_id, period_type, period_start) where category_id is null;
create unique index budgets_category_uq on public.budgets (user_id, period_type, category_id, period_start) where category_id is not null;
create index budgets_user_idx on public.budgets (user_id, period_type, period_start desc);

-- ---------------------------------------------------------------------------
-- perencanaan keuangan bulanan
-- ---------------------------------------------------------------------------
create table public.financial_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  month       date not null check (extract(day from month) = 1),
  salary      bigint not null default 0 check (salary >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, month),
  unique (user_id, id)
);

create table public.plan_items (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan_id      uuid not null,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  kind         text not null default 'budget' check (kind in ('fixed', 'budget')),
  category_id  uuid,
  amount       bigint not null default 0 check (amount >= 0),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  foreign key (user_id, plan_id) references public.financial_plans (user_id, id) on delete cascade,
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete set null (category_id)
);
create index plan_items_plan_idx on public.plan_items (user_id, plan_id);

-- ---------------------------------------------------------------------------
-- tujuan keuangan
--   Kontribusi hanyalah penanda alokasi (earmark). Kontribusi TIDAK membuat
--   transaksi dan TIDAK mengubah saldo akun, sehingga tidak ada pengurangan ganda.
-- ---------------------------------------------------------------------------
create table public.financial_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 100),
  target_amount  bigint not null check (target_amount > 0),
  deadline       date,
  note           text check (note is null or char_length(note) <= 500),
  status         text not null default 'active' check (status in ('active', 'achieved', 'cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, id)
);
create index financial_goals_user_idx on public.financial_goals (user_id, status);

create table public.goal_contributions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  goal_id         uuid not null,
  amount          bigint not null check (amount > 0),
  contributed_on  date not null,
  note            text check (note is null or char_length(note) <= 500),
  created_at      timestamptz not null default now(),
  foreign key (user_id, goal_id) references public.financial_goals (user_id, id) on delete cascade
);
create index goal_contributions_goal_idx on public.goal_contributions (user_id, goal_id, contributed_on desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'accounts', 'categories', 'transactions', 'budgets',
    'financial_plans', 'plan_items', 'financial_goals'
  ] loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Saldo akun: SATU-SATUNYA tempat perhitungan saldo.
--   saldo = saldo awal + pemasukan + transfer masuk - pengeluaran - transfer keluar
-- security_invoker: RLS tabel dasar tetap berlaku untuk pemanggil.
-- ---------------------------------------------------------------------------
create or replace view public.account_balances
with (security_invoker = true) as
select
  a.id,
  a.user_id,
  a.name,
  a.kind,
  a.initial_balance,
  a.is_archived,
  a.sort_order,
  (
    a.initial_balance
    + coalesce((
        select sum(case t.type when 'income' then t.amount else -t.amount end)
        from public.transactions t
        where t.account_id = a.id
      ), 0)
    + coalesce((
        select sum(t.amount)
        from public.transactions t
        where t.to_account_id = a.id
      ), 0)
  )::bigint as balance
from public.accounts a;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_delete_own on public.profiles for delete to authenticated using (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budgets',
    'financial_plans', 'plan_items', 'financial_goals', 'goal_contributions'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %1$s_select_own on public.%1$I for select to authenticated
         using (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_insert_own on public.%1$I for insert to authenticated
         with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_update_own on public.%1$I for update to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format(
      'create policy %1$s_delete_own on public.%1$I for delete to authenticated
         using (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Pengguna anonim tidak boleh menyentuh data apa pun.
revoke all on all tables in schema public from anon;
revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;

-- ---------------------------------------------------------------------------
-- Data awal per pengguna: profil, 2 akun, dan kategori bawaan (BUKAN transaksi).
-- ---------------------------------------------------------------------------
create or replace function public.seed_user_defaults(p_user uuid, p_full_name text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name) values (p_user, nullif(btrim(p_full_name), ''))
  on conflict (id) do nothing;

  insert into public.accounts (user_id, name, kind, sort_order)
  values (p_user, 'Tunai', 'cash', 0), (p_user, 'QRIS/Rekening', 'bank', 1)
  on conflict do nothing;

  insert into public.categories (user_id, name, type, sort_order)
  select p_user, c.name, c.type, c.ord
  from (values
    ('Gaji', 'income', 0),
    ('Bonus', 'income', 1),
    ('Hadiah', 'income', 2),
    ('Pemasukan lain', 'income', 3),
    ('Makan', 'expense', 0),
    ('Belanja bahan masak', 'expense', 1),
    ('Transportasi', 'expense', 2),
    ('Pulsa dan paket data', 'expense', 3),
    ('Sabun dan kebutuhan harian', 'expense', 4),
    ('Skincare', 'expense', 5),
    ('Kos', 'expense', 6),
    ('Listrik', 'expense', 7),
    ('Kebersihan', 'expense', 8),
    ('Hiburan', 'expense', 9),
    ('Pakaian', 'expense', 10),
    ('Hadiah untuk teman', 'expense', 11),
    ('Tabungan atau tujuan keuangan', 'expense', 12),
    ('Lainnya', 'expense', 13)
  ) as c(name, type, ord)
  on conflict do nothing;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user_defaults(new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cadangan: dipanggil aplikasi bila profil belum ada (mis. pengguna dibuat sebelum migration).
create or replace function public.bootstrap_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tidak terautentikasi' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    perform public.seed_user_defaults(v_uid, null);
  end if;
end;
$$;

revoke all on function public.seed_user_defaults(uuid, text) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.bootstrap_current_user() from public, anon;
grant execute on function public.bootstrap_current_user() to authenticated;
