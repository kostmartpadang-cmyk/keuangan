"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDigits, parseRupiah } from "@/lib/money";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Select native: nyaman di HP (picker bawaan) dan ikut FormData. */
export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-base outline-none transition-colors sm:h-9 sm:text-sm",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
          "aria-invalid:border-destructive dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
    );
  },
);

/** Input nominal Rupiah dengan pemisah ribuan; nilai selalu bilangan bulat. */
export function MoneyInput({
  value,
  onChange,
  id,
  invalid,
  className,
  autoFocus,
  allowNegative = false,
  placeholder = "0",
}: {
  value: number;
  onChange: (n: number) => void;
  id?: string;
  invalid?: boolean;
  className?: string;
  autoFocus?: boolean;
  allowNegative?: boolean;
  placeholder?: string;
}) {
  const [negative, setNegative] = React.useState(value < 0);
  const shown = formatDigits(Math.abs(value));

  return (
    <div
      className={cn(
        "flex h-12 items-center gap-2 rounded-xl border border-input bg-transparent px-3 transition-colors sm:h-10",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
        invalid && "border-destructive",
        className,
      )}
    >
      <span className="text-sm font-medium text-muted-foreground">{negative && allowNegative ? "-Rp" : "Rp"}</span>
      <input
        id={id}
        autoFocus={autoFocus}
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          const raw = e.target.value;
          const neg = allowNegative && raw.trim().startsWith("-");
          setNegative(neg);
          const n = parseRupiah(raw);
          onChange(neg ? -n : n);
        }}
        className="tabular w-full bg-transparent text-lg font-semibold outline-none placeholder:text-muted-foreground/60 sm:text-base"
      />
    </div>
  );
}

/** Input kata sandi dengan tombol mata untuk menampilkan/menyembunyikan isinya. */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-11", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
