-- Hari mulai "minggu" per pengguna: 1 = Senin … 7 = Minggu.
alter table public.profiles
  add column if not exists week_start_day smallint not null default 1
  check (week_start_day between 1 and 7);

-- Anggaran mingguan kini boleh dimulai di hari apa pun (sebelumnya harus Senin);
-- anggaran bulanan boleh dimulai di tanggal 1–28.
alter table public.budgets drop constraint if exists budgets_period_start_valid;
alter table public.budgets add constraint budgets_period_start_valid check (
  period_type = 'weekly'
  or (period_type = 'monthly' and extract(day from period_start) between 1 and 28)
);
