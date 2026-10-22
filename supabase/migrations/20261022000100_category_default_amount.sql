-- Nominal tetap per kategori (mis. ongkos transportasi). Dipakai sebagai isian otomatis di form transaksi; tetap bisa diubah per transaksi.
alter table public.categories
  add column if not exists default_amount bigint check (default_amount is null or default_amount > 0);

-- Isian awal untuk kategori Transportasi (bisa diubah di Pengaturan → Kategori).
update public.categories
   set default_amount = 3500
 where type = 'expense' and lower(name) = 'transportasi' and default_amount is null;
