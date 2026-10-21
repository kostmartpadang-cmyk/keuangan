import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AuthShell title="Buat kata sandi baru" subtitle={user ? undefined : undefined}>
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="grid gap-3 text-sm text-muted-foreground">
          <p>Sesi pemulihan tidak ditemukan atau sudah kedaluwarsa. Minta tautan baru untuk melanjutkan.</p>
          <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
            Minta tautan baru
          </Link>
        </div>
      )}
    </AuthShell>
  );
}
