import { ImageResponse } from "next/og";

import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;

/** La carte de partage : parchemin, filet doré, capitales. Pas de police
 *  téléchargée ici — Satori ne lit que ce qu'on lui donne, et le rendu doit
 *  rester fiable à la construction. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f2e8d5",
          color: "#2a2119",
          padding: 64,
          fontFamily: "Georgia, serif",
          border: "16px solid #fbf5e9",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 28 28" fill="none" stroke="#9a7534" strokeWidth="1.6">
            <path d="M14 2 L19.5 14 L14 26 L8.5 14 Z" />
            <path d="M2 14 H26" />
          </svg>
          <span style={{ fontSize: 30, letterSpacing: 8, color: "#6b5218" }}>
            GW2RP NEXUS
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <span style={{ fontSize: 22, letterSpacing: 7, color: "#8a6828" }}>
            UNIVERS GUILD WARS 2 · JEU DE RÔLE
          </span>
          <span style={{ fontSize: 76, lineHeight: 1.1, maxWidth: 900 }}>{SITE_TAGLINE}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 240, height: 3, background: "#9a7534" }} />
          <span style={{ fontSize: 24, color: "#6f5e45" }}>
            Personnages · Carte · Évènements · Rumeurs
          </span>
        </div>
      </div>
    ),
    size,
  );
}
