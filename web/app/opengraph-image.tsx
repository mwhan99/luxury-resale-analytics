import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";

// The picture shown when a link is shared (LinkedIn, Slack, iMessage, email).

export const alt = "Resale Analytics: which part of a luxury resale business actually makes money?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const EYEBROW = "CASE STUDY · TOKYO → LONDON";
const TITLE = "Which part of a luxury resale business actually makes money?";
const FOOTER = ["Lot pricing", "Channel profit", "Shopify break-even"];

// Fraunces from Google Fonts, only the letters used (a few KB). Falls back to
// the built-in font if the fetch fails. Built once, then cached.
async function fraunces(text: string) {
  "use cache";
  cacheLife("max");
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Fraunces:wght@600&text=${encodeURIComponent(text)}`)
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const response = await fetch(url);
    return response.ok ? { name: "Fraunces", data: await response.arrayBuffer(), weight: 600 as const, style: "normal" as const } : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const font = await fraunces("Resale Analytics" + TITLE);
  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
        padding: "72px 80px", backgroundColor: "#f6f1e9", color: "#1f1a15",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="60" height="60" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="9" fill="#1f4d3a" />
            <path d="M11 13v-1.5a5 5 0 0 1 10 0V13" fill="none" stroke="#f4e8d0" strokeWidth="2" strokeLinecap="round" />
            <rect x="7.5" y="13" width="17" height="11.5" rx="3" fill="#f4e8d0" />
            <circle cx="16" cy="18.5" r="1.6" fill="#a87b2f" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontFamily: "Fraunces" }}>Resale Analytics</div>
            <div style={{ fontSize: 18, color: "#958a7e", letterSpacing: 2 }}>{EYEBROW}</div>
          </div>
        </div>
        <div style={{ fontSize: 74, lineHeight: 1.08, fontFamily: "Fraunces", maxWidth: 1000 }}>{TITLE}</div>
        <div style={{ display: "flex", gap: 14 }}>
          {FOOTER.map((f) => (
            <div key={f} style={{ fontSize: 24, padding: "10px 22px", borderRadius: 999, backgroundColor: "#e2ece5", color: "#1f4d3a" }}>{f}</div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts: font ? [font] : [] },
  );
}
