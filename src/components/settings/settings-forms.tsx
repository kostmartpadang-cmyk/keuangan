"use client";

import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
import { updatePassword, updateProfile } from "@/actions/auth";
import { createCategory, deleteCategory, updateCategory } from "@/actions/categories";
import { Field, MoneyInput } from "@/components/forms/fields";
import { formatRupiah } from "@/lib/money";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRunAction } from "@/hooks/use-run-action";
import type { Category, CategoryType } from "@/lib/types";

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(fullName);
  const [error, setError] = useState<string>();

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(undefined);
        run(() => updateProfile({ full_name: name }), { onError: (r) => setError(r.fieldErrors?.full_name ?? r.error) });
      }}
    >
      <Field label="Nama" htmlFor="p-name" error={error}>
        <Input id="p-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className="h-10" aria-invalid={!!error} />
      </Field>
      <Field label="Email" htmlFor="p-email" hint="Email digunakan untuk masuk dan tidak bisa diubah di sini.">
        <Input id="p-email" value={email} readOnly disabled className="h-10" />
      </Field>
      <div>
        <Button type="submit" className="h-10 rounded-xl" disabled={pending || name.trim() === fullName}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Simpan profil
        </Button>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const { run, pending } = useRunAction();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        setErrors({});
        run(() => updatePassword({ password: String(fd.get("password") ?? ""), confirm: String(fd.get("confirm") ?? "") }), {
          onSuccess: () => form.reset(),
          onError: (r) => setErrors(r.fieldErrors ?? {}),
        });
      }}
    >
      <Field label="Kata sandi baru" htmlFor="pw-new" error={errors.password} hint="Minimal 8 karakter.">
        <Input id="pw-new" name="password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.password} />
      </Field>
      <Field label="Ulangi kata sandi baru" htmlFor="pw-confirm" error={errors.confirm}>
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.confirm} />
      </Field>
      <div>
        <Button type="submit" variant="outline" className="h-10 rounded-xl" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Ganti kata sandi
        </Button>
      </div>
    </form>
  );
}

function RenameDialog({ category, onClose }: { category: Category; onClose: () => void }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState(category.name);
  const [fixed, setFixed] = useState(category.default_amount ?? 0);
  const [error, setError] = useState<string>();
  const [fixedError, setFixedError] = useState<string>();

  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah kategori</DialogTitle>
          <DialogDescription>Transaksi lama yang memakai kategori ini ikut menampilkan nama baru.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(undefined);
            setFixedError(undefined);
            run(() => updateCategory(category.id, { name, default_amount: category.type === "expense" && fixed > 0 ? fixed : null }), {
              onSuccess: onClose,
              onError: (r) => {
                setError(r.fieldErrors?.name ?? (r.fieldErrors?.default_amount ? undefined : r.error));
                setFixedError(r.fieldErrors?.default_amount);
              },
            });
          }}
        >
          <Field label="Nama kategori" htmlFor="rn-name" error={error}>
            <Input id="rn-name" value={name} maxLength={60} autoFocus onChange={(e) => setName(e.target.value)} className="h-10" />
          </Field>
          {category.type === "expense" && (
            <Field
              label="Nominal tetap (opsional)"
              htmlFor="rn-fixed"
              error={fixedError}
              hint="Terisi otomatis di form transaksi saat kategori ini dipilih, dan tetap bisa diubah per transaksi. Kosongkan (0) untuk menonaktifkan."
            >
              <MoneyInput id="rn-fixed" value={fixed} onChange={setFixed} invalid={!!fixedError} />
            </Field>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryColumn({ title, type, items }: { title: string; type: CategoryType; items: Category[] }) {
  const { run, pending } = useRunAction();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [renaming, setRenaming] = useState<Category | null>(null);

  return (
    <div className="grid content-start gap-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="divide-y rounded-2xl border">
        {items.map((c) => (
          <li key={c.id} className="flex items-center gap-1 px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
            {c.default_amount ? <span className="tabular shrink-0 text-xs text-muted-foreground">{formatRupiah(c.default_amount)}</span> : null}
            <Button variant="ghost" size="icon-sm" aria-label={`Ubah ${c.name}`} className="text-muted-foreground" onClick={() => setRenaming(c)}>
              <Pencil aria-hidden />
            </Button>
            <ConfirmDeleteButton
              ariaLabel={`Hapus ${c.name}`}
              title={`Hapus kategori ${c.name}?`}
              description="Kategori yang sudah dipakai transaksi tidak bisa dihapus (ubah namanya saja). Anggaran kategori ini ikut terhapus."
              action={() => deleteCategory(c.id)}
            />
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Belum ada kategori.</li>}
      </ul>
      <form
        noValidate
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(undefined);
          run(() => createCategory({ name, type }), {
            onSuccess: () => setName(""),
            onError: (r) => setError(r.fieldErrors?.name ?? r.error),
          });
        }}
      >
        <div className="flex-1">
          <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Kategori baru…" aria-label={`Nama kategori ${title.toLowerCase()} baru`} className="h-10" aria-invalid={!!error} />
          {error && (
            <p role="alert" className="mt-1 text-xs font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
        <Button type="submit" variant="outline" className="h-10 rounded-xl" disabled={pending || !name.trim()}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Tambah
        </Button>
      </form>
      {renaming && <RenameDialog key={renaming.id} category={renaming} onClose={() => setRenaming(null)} />}
    </div>
  );
}

export function CategoriesManager({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <CategoryColumn title="Kategori pemasukan" type="income" items={categories.filter((c) => c.type === "income")} />
      <CategoryColumn title="Kategori pengeluaran" type="expense" items={categories.filter((c) => c.type === "expense")} />
    </div>
  );
}
