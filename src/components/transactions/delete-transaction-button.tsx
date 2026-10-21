"use client";

import { deleteTransaction } from "@/actions/transactions";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete";

/** Dibungkus agar Server Component hanya mengoper data (id, teks), bukan fungsi. */
export function DeleteTransactionButton({ id, summary }: { id: string; summary: string }) {
  return (
    <ConfirmDeleteButton
      ariaLabel="Hapus transaksi"
      title="Hapus transaksi ini?"
      description={`${summary} akan dihapus dan saldo akun dihitung ulang. Tindakan ini tidak bisa dibatalkan.`}
      action={() => deleteTransaction(id)}
    />
  );
}
