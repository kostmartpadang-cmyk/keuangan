import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const authError = sp.error === "auth";

  return (
    <AuthShell
      title="Selamat datang kembali"
      subtitle="Masuk untuk melanjutkan mencatat keuangan Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link href="/register" className="font-semibold text-primary hover:underline">
            Daftar
          </Link>
        </>
      }
    >
      {authError && (
        <p role="alert" className="mb-4 rounded-xl bg-expense-soft px-3 py-2 text-sm text-expense">
          Tautan sudah kedaluwarsa atau tidak valid. Silakan coba lagi.
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
