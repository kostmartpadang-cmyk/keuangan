-- Tanggal mulai "bulan" per pengguna (mis. tanggal gajian). 1 = bulan kalender biasa.
alter table public.profiles
  add column if not exists month_start_day smallint not null default 1
  check (month_start_day between 1 and 28);

-- Anggaran bulanan kini boleh dimulai di tanggal 1–28 (sebelumnya harus tanggal 1).
alter table public.budgets drop constraint if exists budgets_period_start_valid;
alter table public.budgets add constraint budgets_period_start_valid check (
  (period_type = 'weekly'  and extract(isodow from period_start) = 1)
  or (period_type = 'monthly' and extract(day from period_start) between 1 and 28)
);
