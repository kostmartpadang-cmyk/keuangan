"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { login, register, requestPasswordReset, updatePassword } from "@/actions/auth";
import { Field } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/hooks/use-run-action";

type Errors = Record<string, string>;

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-base sm:h-10 sm:text-sm" disabled={pending}>
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const { run, pending } = useRunAction();
  const [errors, setErrors] = useState<Errors>({});

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErrors({});
        run(() => login({ email: String(fd.get("email") ?? ""), password: String(fd.get("password") ?? "") }, next), {
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="h-11 sm:h-9" aria-invalid={!!errors.email} />
      </Field>
      <Field label="Kata sandi" htmlFor="password" error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" className="h-11 sm:h-9" aria-invalid={!!errors.password} />
      </Field>
      <div className="-mt-2 text-right">
        <Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">
          Lupa kata sandi?
        </Link>
      </div>
      <SubmitButton pending={pending}>Masuk</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const { run, pending } = useRunAction();
  const [errors, setErrors] = useState<Errors>({});
  const [doneMessage, setDoneMessage] = useState<string | null>(null);

  if (doneMessage) {
    return (
      <div className="grid gap-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{doneMessage}</p>
        <Button render={<Link href="/login" />} nativeButton={false} variant="outline" className="h-10 rounded-xl">
          Ke halaman masuk
        </Button>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErrors({});
        run(
          () =>
            register({
              full_name: String(fd.get("full_name") ?? ""),
              email: String(fd.get("email") ?? ""),
              password: String(fd.get("password") ?? ""),
              confirm: String(fd.get("confirm") ?? ""),
            }),
          {
            silentSuccess: true,
            onSuccess: (r) => setDoneMessage(r.message ?? "Pendaftaran berhasil."),
            onError: (r) => setErrors(r.fieldErrors ?? {}),
          },
        );
      }}
    >
      <Field label="Nama" htmlFor="full_name" error={errors.full_name}>
        <Input id="full_name" name="full_name" autoComplete="name" className="h-11 sm:h-9" aria-invalid={!!errors.full_name} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="h-11 sm:h-9" aria-invalid={!!errors.email} />
      </Field>
      <Field label="Kata sandi" htmlFor="password" error={errors.password} hint="Minimal 8 karakter.">
        <Input id="password" name="password" type="password" autoComplete="new-password" className="h-11 sm:h-9" aria-invalid={!!errors.password} />
      </Field>
      <Field label="Ulangi kata sandi" htmlFor="confirm" error={errors.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" className="h-11 sm:h-9" aria-invalid={!!errors.confirm} />
      </Field>
      <SubmitButton pending={pending}>Daftar</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const { run, pending } = useRunAction();
  const [errors, setErrors] = useState<Errors>({});
  const [sent, setSent] = useState<string | null>(null);

  if (sent) {
    return (
      <div className="grid gap-4 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{sent}</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErrors({});
        run(() => requestPasswordReset({ email: String(fd.get("email") ?? "") }), {
          silentSuccess: true,
          onSuccess: (r) => setSent(r.message ?? "Tautan terkirim."),
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" className="h-11 sm:h-9" aria-invalid={!!errors.email} />
      </Field>
      <SubmitButton pending={pending}>Kirim tautan reset</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const { run, pending } = useRunAction();
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setErrors({});
        run(() => updatePassword({ password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") }), {
          onSuccess: () => router.replace("/dashboard"),
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Field label="Kata sandi baru" htmlFor="password" error={errors.password} hint="Minimal 8 karakter.">
        <Input id="password" name="password" type="password" autoComplete="new-password" className="h-11 sm:h-9" aria-invalid={!!errors.password} />
      </Field>
      <Field label="Ulangi kata sandi baru" htmlFor="confirm" error={errors.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" className="h-11 sm:h-9" aria-invalid={!!errors.confirm} />
      </Field>
      <SubmitButton pending={pending}>Simpan kata sandi</SubmitButton>
    </form>
  );
}
