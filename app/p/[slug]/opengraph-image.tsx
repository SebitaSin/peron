import fs from "node:fs";
import { ImageResponse } from "next/og";
import { getCharacter } from "@/characters";
import { portraitFor } from "@/lib/portrait";

export const alt = "Historia Viva — conversación con una reconstrucción histórica";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pack = getCharacter(slug);
  const name = pack?.profile.name ?? "Historia Viva";
  const when = pack ? `${pack.profile.place} · ${pack.profile.date_label}` : "";
  const p = portraitFor(slug);
  const portrait = p ? `data:${p.mime};base64,${fs.readFileSync(p.file).toString("base64")}` : null;
  const initials = name
    .split(" ")
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join("")
    .slice(0, 3);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "linear-gradient(135deg,#0d1829 0%,#070d18 70%)",
          color: "#f3eee2",
          padding: "0 90px",
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 10, background: "#b79a63", display: "flex" }} />
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: 300,
            border: "4px solid #b79a63",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            background: "#132138",
            fontSize: 110,
            color: "#b79a63",
            letterSpacing: 4,
            flexShrink: 0,
          }}
        >
          {portrait ? (
            <img src={portrait} width={300} height={300} alt="" style={{ objectFit: "cover" }} />
          ) : (
            initials
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 70 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, color: "#b79a63", textTransform: "uppercase", display: "flex" }}>Historia Viva</div>
          <div style={{ fontSize: 84, lineHeight: 1.05, marginTop: 18, display: "flex" }}>{name}</div>
          <div style={{ fontSize: 34, color: "#9aa5b8", marginTop: 22, display: "flex" }}>{when}</div>
          <div style={{ fontSize: 28, marginTop: 38, display: "flex", color: "#f3eee2" }}>Conversá con una reconstrucción histórica.</div>
        </div>
      </div>
    ),
    size,
  );
}
