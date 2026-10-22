import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRupiah } from "@/lib/money";
import type { BudgetLevel } from "@/lib/finance/budgets";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="grid gap-1">
        <p className="font-semibold">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Money({
  value,
  tone,
  signed,
  className,
}: {
  value: number;
  tone?: "income" | "expense" | "auto" | "none";
  signed?: boolean;
  className?: string;
}) {
  const t = tone ?? "none";
  const color =
    t === "income"
      ? "text-income"
      : t === "expense"
        ? "text-expense"
        : t === "auto"
          ? value < 0
            ? "text-expense"
            : ""
          : "";
  const text = signed && value > 0 ? `+${formatRupiah(value)}` : formatRupiah(value);
  return <span className={cn("tabular whitespace-nowrap", color, className)}>{text}</span>;
}

const LEVEL_BAR: Record<BudgetLevel, string> = {
  none: "bg-muted-foreground/40",
  ok: "bg-income",
  warning: "bg-warning",
  over: "bg-expense",
};

/** Progress bar dengan warna sesuai tingkat anggaran. `ratio` boleh > 1 (dipotong secara visual). */
export function ProgressBar({
  ratio,
  level = "ok",
  label,
  className,
}: {
  ratio: number;
  level?: BudgetLevel;
  label: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", LEVEL_BAR[level])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "income" | "expense" | "neutral";
  className?: string;
}) {
  return (
    <div className={cn("animate-fade-up rounded-2xl border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-xl",
              tone === "income" && "bg-income-soft text-income",
              tone === "expense" && "bg-expense-soft text-expense",
              (!tone || tone === "neutral") && "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <p className="tabular mt-2 text-xl font-bold tracking-tight min-[400px]:text-2xl sm:text-[1.7rem]">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("animate-fade-up rounded-2xl border bg-card p-4 sm:p-5", className)}>
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
