/**
 * Serialisasi CSV yang aman dibuka di Excel/Google Sheets.
 * - Sel yang diawali = + - @ (atau tab/CR) diberi awalan ' untuk mencegah formula injection.
 * - BOM UTF-8 agar karakter non-ASCII tampil benar di Excel.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(csvCell).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
