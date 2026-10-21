import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RuangUang — Catatan Keuangan",
    short_name: "RuangUang",
    description: "Catat pemasukan dan pengeluaran, atur anggaran, dan pantau sisa uang.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "id",
    background_color: "#fbfaf7",
    theme_color: "#1f4d3f",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Tambah transaksi", url: "/transactions/new" }],
  };
}
