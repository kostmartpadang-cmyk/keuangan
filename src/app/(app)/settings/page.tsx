import type { Metadata } from "next";
import { Download } from "lucide-react";
import { NotificationToggle } from "@/components/pwa/notifications";
import { InstallButton } from "@/components/pwa/install";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CategoriesManager, MonthStartForm, PasswordForm, ProfileForm } from "@/components/settings/settings-forms";
import { PageHeader, SectionCard } from "@/components/shared/ui-bits";
import { Button } from "@/components/ui/button";
import { getProfile, requireUser } from "@/lib/data/auth";
import { getCategories } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const [profile, categories] = await Promise.all([getProfile(), getCategories(supabase)]);

  return (
    <div className="grid gap-5">
      <PageHeader title="Pengaturan" description="Profil, tampilan, kategori, dan data Anda." />

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Profil">
          <ProfileForm fullName={profile.full_name ?? ""} email={user.email ?? ""} />
        </SectionCard>
        <SectionCard title="Keamanan">
          <PasswordForm />
        </SectionCard>
      </div>

      <SectionCard
        title="Periode bulanan"
        description="Atur tanggal gajian Anda. Anggaran bulanan, 'Bulan ini' di Beranda, dan perbandingan bulan di Laporan akan dihitung dari tanggal ini."
      >
        <MonthStartForm key={profile.month_start_day} day={profile.month_start_day} />
      </SectionCard>

      <SectionCard title="Tampilan" description="Mengikuti pengaturan perangkat secara bawaan.">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Mata uang Rupiah (IDR) · zona waktu Asia/Jakarta</span>
          <ThemeToggle withLabel />
        </div>
      </SectionCard>

      <SectionCard title="Notifikasi" description="Dapatkan pemberitahuan di HP saat sisa anggaran mingguan tinggal 10% atau terlampaui.">
        <NotificationToggle />
      </SectionCard>

      <SectionCard title="Aplikasi" description="Pasang RuangUang di layar utama agar terbuka seperti aplikasi biasa.">
        <div className="grid gap-3 text-sm text-muted-foreground">
          <div className="empty:hidden">
            <InstallButton className="h-10 rounded-xl" />
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs">
            <li>Android/Chrome: ketuk tombol Pasang aplikasi, atau menu ⋮ → Instal aplikasi.</li>
            <li>iPhone/iPad (Safari): Bagikan → Tambah ke Layar Utama.</li>
          </ul>
          <p className="text-xs">Aplikasi tetap membutuhkan internet untuk menyimpan data.</p>
        </div>
      </SectionCard>

      <SectionCard title="Kategori" description="Kategori dipakai di transaksi, anggaran, dan laporan.">
        <CategoriesManager categories={categories} />
      </SectionCard>

      <SectionCard title="Data Anda" description="Salinan seluruh transaksi dalam format CSV (bisa dibuka di Excel atau Google Sheets).">
        <Button render={<a href="/api/export" download />} nativeButton={false} variant="outline" className="h-10 rounded-xl">
          <Download aria-hidden /> Ekspor semua transaksi (CSV)
        </Button>
      </SectionCard>
    </div>
  );
}
