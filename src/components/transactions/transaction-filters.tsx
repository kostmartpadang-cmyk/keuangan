"use client";

import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { NativeSelect } from "@/components/forms/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Account, Category } from "@/lib/types";

export interface FilterValues {
  q?: string;
  type?: string;
  category?: string;
  account?: string;
  from?: string;
  to?: string;
  sort?: string;
}

const dateCls =
  "h-10 w-full rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

export function TransactionFilters({
  values,
  categories,
  accounts,
}: {
  values: FilterValues;
  categories: Category[];
  accounts: Account[];
}) {
  const active = Boolean(values.q || values.type || values.category || values.account || values.from || values.to);

  return (
    <Form
      action="/transactions"
      className="grid gap-2 rounded-2xl border bg-card p-3 sm:p-4"
      // Select dan tanggal langsung menerapkan filter; kolom cari lewat Enter / tombol.
      onChange={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "SELECT" || (t as HTMLInputElement).type === "date") e.currentTarget.requestSubmit();
      }}
    >
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={values.q} placeholder="Cari catatan…" aria-label="Cari catatan" className="h-10 rounded-xl pl-9" />
        </div>
        <Button type="submit" className="h-10 rounded-xl">
          Cari
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <NativeSelect name="type" defaultValue={values.type ?? ""} aria-label="Tipe" className="h-10 sm:h-10">
          <option value="">Semua tipe</option>
          <option value="income">Pemasukan</option>
          <option value="expense">Pengeluaran</option>
          <option value="transfer">Transfer</option>
        </NativeSelect>
        <NativeSelect name="category" defaultValue={values.category ?? ""} aria-label="Kategori" className="h-10 sm:h-10">
          <option value="">Semua kategori</option>
          <optgroup label="Pemasukan">
            {categories.filter((c) => c.type === "income").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Pengeluaran">
            {categories.filter((c) => c.type === "expense").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </NativeSelect>
        <NativeSelect name="account" defaultValue={values.account ?? ""} aria-label="Akun" className="h-10 sm:h-10">
          <option value="">Semua akun</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={values.sort ?? "date_desc"} aria-label="Urutkan" className="h-10 sm:h-10">
          <option value="date_desc">Terbaru</option>
          <option value="date_asc">Terlama</option>
          <option value="amount_desc">Nominal terbesar</option>
          <option value="amount_asc">Nominal terkecil</option>
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <label className="grid gap-1 text-xs text-muted-foreground sm:flex sm:items-center sm:gap-2">
          Dari
          <input type="date" name="from" defaultValue={values.from} className={dateCls} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground sm:flex sm:items-center sm:gap-2">
          Sampai
          <input type="date" name="to" defaultValue={values.to} className={dateCls} />
        </label>
        {active && (
          <Button render={<Link href="/transactions" />} nativeButton={false} variant="ghost" className="col-span-2 h-10 gap-1 sm:ml-auto">
            <X aria-hidden /> Reset filter
          </Button>
        )}
      </div>
    </Form>
  );
}
