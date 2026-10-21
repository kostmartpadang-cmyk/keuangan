"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah, formatRupiahCompact } from "@/lib/money";

const AXIS_TICK = { fill: "var(--chart-axis)", fontSize: 11 };

/** Warna kategorikal berurutan tetap; slot ke-8 dst. dilipat ke "Lainnya". */
export function seriesColor(index: number) {
  return index < 8 ? `var(--series-${index + 1})` : "var(--series-other)";
}

interface TooltipRow {
  name?: string | number;
  value?: number | string;
  color?: string;
  fill?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: readonly TooltipRow[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== "" && <p className="mb-1 font-semibold">{label}</p>}
      <ul className="grid gap-1">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="size-2.5 rounded-sm" style={{ background: p.color ?? p.fill }} aria-hidden />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="tabular ml-auto pl-3 font-semibold">{formatRupiah(Number(p.value ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Lihat sebagai tabel</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-xl border">
        <table className="w-full">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted text-left">
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={`px-3 py-1.5 font-medium ${i > 0 ? "text-right" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                {r.map((cell, j) => (
                  <td key={j} className={`px-3 py-1.5 ${j > 0 ? "tabular text-right" : ""}`}>
                    {typeof cell === "number" ? formatRupiah(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function LegendText({ value }: { value?: string | number }) {
  return <span className="text-xs text-muted-foreground">{value}</span>;
}

// ---------------------------------------------------------------------------
// Pemasukan vs pengeluaran
// ---------------------------------------------------------------------------
export function IncomeExpenseChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  const hasData = data.some((d) => d.income > 0 || d.expense > 0);
  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pemasukan atau pengeluaran pada periode ini.</p>;
  }
  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={formatRupiahCompact} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <LegendText value={v} />} />
            <Bar dataKey="income" name="Pemasukan" fill="var(--chart-income)" radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Pemasukan dan pengeluaran"
        columns={["Periode", "Pemasukan", "Pengeluaran"]}
        rows={data.map((d) => [d.label, d.income, d.expense])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Satu seri pengeluaran (tren mingguan / bulanan)
// ---------------------------------------------------------------------------
export function ExpenseTrendChart({ data, caption }: { data: { label: string; expense: number }[]; caption: string }) {
  if (!data.some((d) => d.expense > 0)) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pengeluaran pada rentang ini.</p>;
  }
  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={formatRupiahCompact} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Bar dataKey="expense" name="Pengeluaran" fill="var(--chart-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={caption} columns={["Periode", "Pengeluaran"]} rows={data.map((d) => [d.label, d.expense])} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Perbandingan antarbulan per kategori
// ---------------------------------------------------------------------------
export function CompareChart({
  data,
  currentLabel,
  previousLabel,
}: {
  data: { label: string; current: number; previous: number }[];
  currentLabel: string;
  previousLabel: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pengeluaran untuk dibandingkan.</p>;
  }
  return (
    <div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={0} height={44} tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={formatRupiahCompact} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
            <Legend iconType="circle" iconSize={8} formatter={(v) => <LegendText value={v} />} />
            <Bar dataKey="previous" name={previousLabel} fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="current" name={currentLabel} fill="var(--series-2)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Perbandingan pengeluaran per kategori"
        columns={["Kategori", previousLabel, currentLabel]}
        rows={data.map((d) => [d.label, d.previous, d.current])}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pengeluaran per kategori: donat + daftar berlegenda
// ---------------------------------------------------------------------------
export interface CategorySlice {
  id: string;
  name: string;
  total: number;
}

/** Tujuh kategori terbesar diberi warna sendiri; sisanya dilipat menjadi "Lainnya". */
function foldSlices(items: CategorySlice[]) {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7);
  const slices = top.map((s, i) => ({ ...s, color: seriesColor(i) }));
  if (rest.length) {
    slices.push({ id: "_rest", name: `Lainnya (${rest.length} kategori)`, total: rest.reduce((a, b) => a + b.total, 0), color: seriesColor(8) });
  }
  return slices;
}

export function CategoryBreakdown({ items }: { items: CategorySlice[] }) {
  const slices = foldSlices(items.filter((i) => i.total > 0));
  const total = slices.reduce((a, b) => a + b.total, 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pengeluaran pada periode ini.</p>;
  }

  return (
    <div className="grid gap-4">
      <div className="relative mx-auto h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="total"
              nameKey="name"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={slices.length > 1 ? 2 : 0}
              stroke="var(--card)"
              strokeWidth={2}
              isAnimationActive={false}
            >
              {slices.map((s) => (
                <Cell key={s.id} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] text-muted-foreground">Total</span>
          <span className="tabular text-sm font-bold">{formatRupiahCompact(total)}</span>
        </div>
      </div>
      <ul className="grid gap-2.5">
        {slices.map((s) => (
          <li key={s.id} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="tabular text-xs text-muted-foreground">{Math.round((s.total / total) * 100)}%</span>
            <span className="tabular w-24 shrink-0 text-right font-semibold">{formatRupiah(s.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
