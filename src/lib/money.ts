/** Format Rupiah: Rp3.182.955 (negatif: -Rp1.000). Nominal selalu bilangan bulat. */
export function formatRupiah(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${n < 0 ? "-" : ""}Rp${abs}`;
}

/** Format ringkas untuk sumbu grafik: 1,2jt / 350rb. */
export function formatRupiahCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  const trim = (x: number) => x.toFixed(1).replace(/\.0$/, "").replace(".", ",");
  if (abs >= 1_000_000_000) return `${sign}${trim(abs / 1_000_000_000)}M`;
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}jt`;
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}rb`;
  return `${sign}${abs}`;
}

/** Ubah teks input ("1.250.000", "Rp 1250000") menjadi bilangan bulat. Kosong → 0. */
export function parseRupiah(input: string): number {
  const digits = input.replace(/\D/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : 0;
}

/** Tampilkan angka di dalam input: 1250000 → "1.250.000". */
export function formatDigits(value: number): string {
  if (!value) return "";
  return Math.round(value).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}
