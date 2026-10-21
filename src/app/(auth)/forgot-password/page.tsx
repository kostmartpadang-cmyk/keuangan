import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Lupa kata sandi?"
      subtitle="Masukkan email Anda, kami kirim tautan untuk membuat kata sandi baru."
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Kembali ke halaman masuk
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
