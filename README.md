# RuangUang

Aplikasi web pencatat keuangan pribadi: pemasukan, pengeluaran, akun uang (tunai & QRIS/rekening), transfer, anggaran mingguan/bulanan, perencanaan gaji, tujuan keuangan, laporan, dan ekspor CSV. Semua data disimpan di **Supabase (PostgreSQL)** dengan **Row Level Security**, sehingga tiap pengguna hanya bisa mengakses datanya sendiri.

**Stack:** Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · shadcn/ui · Supabase (`@supabase/supabase-js`, `@supabase/ssr`) · Recharts · Lucide · PWA.

---

## 1. Instal dependency

Butuh Node.js 20.19+ (disarankan 22/24).

```bash
npm install
```

## 2. Jalankan lokal

```bash
cp .env.example .env.local   # lalu isi nilainya (langkah 3–4)
npm run dev                  # http://localhost:3000
```

Perintah lain: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test`.

## 3. Buat project Supabase

1. Masuk ke <https://supabase.com> → **New project**. Catat password database Anda.
2. Tunggu project selesai dibuat.

## 4. Isi environment variables

Di Supabase: **Project Settings → API**. Salin ke `.env.local`:

| Variabel | Isi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kunci `anon` / *publishable* |

> ⚠️ **Jangan pernah** memakai `service_role` key di aplikasi ini (browser maupun server). Kunci `anon` aman dipublikasikan karena akses data dibatasi RLS.

`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` juga dikenali sebagai pengganti `…_ANON_KEY`.
Opsional: `NEXT_PUBLIC_SITE_URL` (mis. `https://ruanguang.vercel.app`) untuk memaksa domain pada tautan email; bila kosong dipakai domain dari request.

## 5. Jalankan SQL migration dan aktifkan RLS

File: [`supabase/migrations/20261021000000_init_ruanguang.sql`](supabase/migrations/20261021000000_init_ruanguang.sql)

**Cara termudah:** Supabase → **SQL Editor → New query** → tempel seluruh isi file → **Run**.

**Atau dengan Supabase CLI:**

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Migration ini membuat:

- Tabel `profiles`, `accounts`, `categories`, `transactions`, `budgets`, `financial_plans`, `plan_items`, `financial_goals`, `goal_contributions`, dan view `account_balances`.
- **RLS aktif di semua tabel** dengan policy select/insert/update/delete berdasarkan `auth.uid()`.
- Foreign key **komposit** `(user_id, …)` sehingga relasi (mis. transaksi → akun/kategori) tidak bisa menunjuk data milik pengguna lain.
- Constraint: nominal > 0, bentuk transaksi valid (transfer ≠ akun sama), anggaran mingguan harus mulai Senin dan bulanan tanggal 1, dll.
- Trigger pendaftaran: setiap pengguna baru otomatis mendapat profil, akun **Tunai** & **QRIS/Rekening**, dan kategori bawaan — **tanpa transaksi contoh**.

Verifikasi: **Table Editor** → setiap tabel menampilkan badge *RLS enabled*.

### Cara kerja saldo & transfer
- Saldo akun = saldo awal + pemasukan + transfer masuk − pengeluaran − transfer keluar, dihitung **di satu tempat**: view `account_balances`.
- Transfer disimpan sebagai **satu baris** (`type = 'transfer'`), jadi atomik dan tidak dihitung sebagai pemasukan/pengeluaran.
- Kontribusi tujuan keuangan hanya **penanda alokasi**; tidak membuat transaksi dan tidak mengubah saldo, sehingga tidak ada pengurangan ganda. Bila uang dipindah ke rekening tabungan, catat lewat Transfer.

## 6. Atur autentikasi dan URL redirect

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (lokal) lalu ganti dengan domain Vercel Anda saat produksi.
- **Redirect URLs:** tambahkan
  - `http://localhost:3000/auth/callback`
  - `https://<domain-anda>/auth/callback`
  - (opsional untuk preview Vercel) `https://*-<tim>.vercel.app/auth/callback`

**Authentication → Providers → Email:** pastikan *Email* aktif. Untuk pemakaian pribadi Anda bisa mematikan *Confirm email* agar daftar langsung masuk; bila dibiarkan aktif, pengguna harus membuka tautan konfirmasi dari email.

Reset password memakai alur PKCE: tautan harus dibuka di **browser yang sama** dengan tempat permintaan dibuat. Agar bisa dibuka di perangkat lain, ubah template email *Reset Password* menjadi:

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password
```

Email bawaan Supabase dibatasi laju pengiriman; untuk produksi serius pasang SMTP sendiri (Authentication → SMTP Settings).

## 7. Hubungkan GitHub ke Vercel

```bash
git add -A && git commit -m "RuangUang"
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Di <https://vercel.com/new> → **Import** repository → framework terdeteksi otomatis sebagai Next.js.

## 8. Environment variables di Vercel

**Project → Settings → Environment Variables**, tambahkan (Production, Preview, Development):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 9. Deploy dan uji

1. Klik **Deploy**. Setelah selesai, tambahkan domain Vercel ke Supabase (langkah 6).
2. Daftar akun, lalu uji alur utama:
   - Tambah pemasukan & pengeluaran → saldo di **Akun uang** dan angka di **Beranda** berubah.
   - Transfer Tunai ⇄ QRIS/Rekening → total uang tidak berubah.
   - Atur anggaran mingguan/bulanan → progress bar dan peringatan 80%/100% muncul.
   - Edit/hapus transaksi (ada konfirmasi) → grafik & laporan ikut berubah.
   - Logout lalu login kembali → data tetap ada.
   - Buka dengan akun kedua → data akun pertama tidak terlihat.
3. **Pasang sebagai aplikasi (PWA):** di HP buka situs → menu browser → *Tambahkan ke layar utama* / *Instal aplikasi*.

## 10. Backup dan ekspor data

- **Ekspor CSV (per pengguna):** halaman **Laporan** (periode terpilih) atau **Pengaturan → Ekspor semua transaksi**. File memakai UTF-8 BOM dan bisa dibuka di Excel/Google Sheets (di Google Sheets: *File → Impor*).
- **Backup database penuh:** Supabase → **Database → Backups** (otomatis harian pada paket berbayar). Atau manual:
  ```bash
  npx supabase db dump --linked -f backup.sql          # skema
  npx supabase db dump --linked --data-only -f data.sql # data
  ```
- Supabase juga menyediakan ekspor CSV per tabel di **Table Editor**.

---

## Struktur kode

```
supabase/migrations/   skema, RLS, trigger, view saldo
src/proxy.ts           penyegaran sesi + proteksi rute (pengganti middleware di Next 16)
src/lib/supabase/      client browser, server, dan helper sesi
src/lib/finance/       logika murni: agregasi, anggaran, insight, perencanaan (diuji)
src/lib/validation/    skema Zod, dipakai di frontend DAN server action
src/lib/data/          akses database (server-only)
src/actions/           Server Actions (validasi → Supabase, dilindungi RLS)
src/app/(app)/         halaman terautentikasi
src/app/(auth)/        login, daftar, lupa & reset kata sandi
src/components/        UI (shadcn/ui di components/ui)
```

## Keamanan

- RLS di semua tabel + FK komposit; pengguna anonim tidak punya akses.
- Hanya kunci publik di klien; tidak ada `service_role`.
- Setiap Server Action memverifikasi sesi (`auth.getUser()`) dan memvalidasi input dengan Zod; kepemilikan data dijaga RLS dan FK.
- Parameter `next` pada login hanya menerima path internal (anti open-redirect). Ekspor CSV menetralkan *formula injection*.
- Header keamanan dasar diatur di `next.config.ts`.

## Perilaku offline (PWA)

Aplikasi **bisa dipasang** dan menampilkan halaman *offline* saat tidak ada koneksi, tetapi **tidak** menyimpan atau mengantrekan transaksi secara offline. Saat offline, banner muncul dan tombol simpan menampilkan pesan bahwa perubahan **belum tersimpan** — tidak pernah ada klaim berhasil palsu. Pengiriman ganda (klik dua kali / kirim ulang) dicegah dengan `client_id` unik per transaksi.

## Batasan yang diketahui

- Belum ada penghapusan akun mandiri (butuh kunci service role di server; sengaja tidak dipakai). Hapus pengguna lewat dashboard Supabase.
- Pencarian transaksi hanya pada kolom catatan; kategori & akun lewat filter.
- Mata uang hanya Rupiah dan zona waktu tetap Asia/Jakarta.
- Anggaran per kategori diatur per periode berjalan dan berlaku seterusnya sampai diubah (isi 0 untuk menghapus).
- Uji otomatis mencakup logika keuangan (`npm test`); alur penuh dengan Supabase nyata perlu diuji manual setelah migration dijalankan (langkah 9).
