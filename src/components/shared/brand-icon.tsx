import { ImageResponse } from "next/og";

/** Ikon aplikasi: kotak hijau tua dengan huruf R. `maskable` memberi ruang aman lebih besar. */
export function renderBrandIcon(size: number, maskable = false) {
  const inner = maskable ? size * 0.5 : size * 0.62;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f4d3f",
          borderRadius: maskable ? 0 : size * 0.22,
        }}
      >
        <div
          style={{
            width: inner,
            height: inner,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: inner * 0.3,
            background: "#e9f5ee",
            color: "#1f4d3f",
            fontSize: inner * 0.68,
            fontWeight: 800,
          }}
        >
          R
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
