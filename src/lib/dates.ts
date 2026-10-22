// Semua tanggal diperlakukan sebagai string "YYYY-MM-DD" pada zona waktu Asia/Jakarta,
// sehingga tidak ada pergeseran hari akibat konversi UTC.

export const TIME_ZONE = "Asia/Jakarta";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const DAYS_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export type ISODate = string;

export function todayJakarta(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = parse(s);
  return toISO(d) === s;
}

function parse(s: ISODate): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

/** Geser n bulan dari tanggal 1 bulan tersebut. */
export function addMonths(s: ISODate, n: number): ISODate {
  const d = parse(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return toISO(d);
}

export function monthStart(s: ISODate): ISODate {
  return `${s.slice(0, 7)}-01`;
}

export function monthEnd(s: ISODate): ISODate {
  return addDays(addMonths(s, 1), -1);
}

/** Hari mulai "bulan" yang boleh dipilih (maks. 28 agar ada di setiap bulan). */
export const MAX_MONTH_START_DAY = 28;

/** Normalisasi hari mulai bulan ke bilangan bulat 1–28 (selain itu dianggap 1). */
export function normalizeStartDay(day: unknown): number {
  const n = Number(day);
  return Number.isInteger(n) && n >= 1 && n <= MAX_MONTH_START_DAY ? n : 1;
}

/**
 * Awal "bulan" berjalan bila bulan dihitung dari tanggal `day` (mis. gajian tanggal 25:
 * 25 Okt – 24 Nov). day = 1 sama dengan bulan kalender.
 */
export function cycleStart(s: ISODate, day = 1): ISODate {
  if (day <= 1) return monthStart(s);
  const base = Number(s.slice(8, 10)) >= day ? monthStart(s) : addMonths(s, -1);
  return `${base.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

/** Geser n "bulan" dari awal periode `start`. */
export function addCycles(start: ISODate, n: number, day = 1): ISODate {
  const base = addMonths(start, n);
  return day <= 1 ? base : `${base.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

/** Hari terakhir "bulan" yang dimulai pada `start`. */
export function cycleEnd(start: ISODate, day = 1): ISODate {
  return addDays(addCycles(start, 1, day), -1);
}

/** Label "bulan": nama bulan untuk bulan kalender, rentang tanggal bila mulai bukan tanggal 1. */
export function formatCycle(start: ISODate, day = 1): string {
  return day <= 1 ? formatMonthYear(start) : `${formatDayMonth(start)} – ${formatDayMonth(cycleEnd(start, day))}`;
}

/** 0 = Senin … 6 = Minggu */
function isoWeekday(s: ISODate): number {
  return (parse(s).getUTCDay() + 6) % 7;
}

/** Minggu berjalan dari Senin sampai Minggu. */
export function weekStart(s: ISODate): ISODate {
  return addDays(s, -isoWeekday(s));
}

export function weekEnd(s: ISODate): ISODate {
  return addDays(weekStart(s), 6);
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

export function formatDate(s: ISODate): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
}

export function formatDayMonth(s: ISODate): string {
  const [, m, d] = s.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

export function formatMonthYear(s: ISODate): string {
  const [y, m] = s.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function formatMonthShort(s: ISODate): string {
  const [y, m] = s.split("-").map(Number);
  return `${MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function formatWeekday(s: ISODate): string {
  return DAYS_SHORT[parse(s).getUTCDay()];
}

export function formatRange(from: ISODate, to: ISODate): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}

/** Daftar tanggal berurutan dari `from` sampai `to` (inklusif). */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export type PeriodKey = "today" | "week" | "month" | "last_month" | "custom";

export interface Period {
  key: PeriodKey;
  from: ISODate;
  to: ISODate;
  label: string;
}

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Hari ini",
  week: "Minggu ini",
  month: "Bulan ini",
  last_month: "Bulan sebelumnya",
  custom: "Rentang khusus",
};

export function isPeriodKey(v: unknown): v is PeriodKey {
  return typeof v === "string" && v in PERIOD_LABELS;
}

export function resolvePeriod(
  key: PeriodKey,
  custom: { from?: string; to?: string } = {},
  today: ISODate = todayJakarta(),
  startDay = 1,
): Period {
  switch (key) {
    case "today":
      return { key, from: today, to: today, label: PERIOD_LABELS.today };
    case "week":
      return { key, from: weekStart(today), to: weekEnd(today), label: PERIOD_LABELS.week };
    case "last_month": {
      const from = addCycles(cycleStart(today, startDay), -1, startDay);
      return { key, from, to: cycleEnd(from, startDay), label: PERIOD_LABELS.last_month };
    }
    case "custom": {
      const f = custom.from && isValidISODate(custom.from) ? custom.from : undefined;
      const t = custom.to && isValidISODate(custom.to) ? custom.to : undefined;
      if (f && t) {
        const [from, to] = f <= t ? [f, t] : [t, f];
        return { key, from, to, label: formatRange(from, to) };
      }
      return resolvePeriod("month", {}, today, startDay);
    }
    case "month":
    default:
      const from = cycleStart(today, startDay);
      return { key: "month", from, to: cycleEnd(from, startDay), label: PERIOD_LABELS.month };
  }
}

/** Baca ?p=&from=&to= dari URL menjadi Period. */
export function periodFromSearchParams(
  sp: { p?: string | string[]; from?: string | string[]; to?: string | string[] },
  fallback: PeriodKey = "month",
  startDay = 1,
): Period {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const p = one(sp.p);
  const key = isPeriodKey(p) ? p : fallback;
  return resolvePeriod(key, { from: one(sp.from), to: one(sp.to) }, todayJakarta(), startDay);
}
