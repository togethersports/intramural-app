import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Intramural — run your school league like the pros";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The link-preview image (Slack, iMessage, Twitter/X, Vercel deploy
 * comments…). Redraws The Bracket mark inline — Satori (the renderer behind
 * ImageResponse) supports basic SVG primitives directly, same construction
 * spec as components/mark.tsx: 64x64 grid, seeds in, one line out in
 * Whistle Red.
 */
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#17171A",
        }}
      >
        <svg width={200} height={200} viewBox="0 0 64 64" fill="none">
          <g stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" fill="none">
            <path d="M10 18h22" />
            <path d="M10 46h22" />
            <path d="M32 18v28" />
          </g>
          <path
            d="M32 32h22"
            stroke="#C9242C"
            strokeWidth={6}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 600,
              color: "#FFFFFF",
              letterSpacing: "-2px",
            }}
          >
            Intramural
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 500,
              color: "#8FA6BF",
              marginTop: 14,
            }}
          >
            Run your league like the pros.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
