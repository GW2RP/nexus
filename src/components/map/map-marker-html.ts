import type { EventType, PlaceType } from "@/lib/domain";

/** Le pin de carte est du HTML posé dans un `divIcon` : il hérite des jetons et
 *  bascule avec le thème sans code supplémentaire. Le glyphe d'un pin est le même
 *  que celui de la puce de type correspondante. */

const GLYPHS: Record<string, string> = {
  taverne: '<path d="M4 3 h7 l-1 9 h-5 z M11 5 h3 v4 h-3"/>',
  aventure: '<path d="M3 13 L11 5 M9 3 L13 7 M2.5 12.5 L3.5 13.5"/>',
  commerce:
    '<circle cx="8" cy="8" r="5"/><path d="M8 5.2 v5.6 M6.4 6.6 h3.2"/>',
  ceremonie: '<path d="M4.5 2.5 h7 v7 l-3.5 -2 -3.5 2 z M8 9.5 v4"/>',
  guilde: '<path d="M4.5 2.5 h7 v7 l-3.5 -2 -3.5 2 z M8 9.5 v4"/>',
  intrigue: '<path d="M8 2.5 v11 M4 5 h8 M3 5 l-1.5 3.5 h3 z M13 5 l1.5 3.5 h-3 z"/>',
  ruine: '<path d="M3 13 h10 M4.5 13 v-6 M7.5 13 v-8 M10.5 13 v-5"/>',
};

export type MarkerState = "lieu" | "en-cours" | "annonce" | "selectionne";

export function markerHtml(type: PlaceType | EventType, state: MarkerState): string {
  const glyph = GLYPHS[type] ?? GLYPHS.taverne;
  const size = state === "selectionne" ? 44 : 34;

  const styles: Record<MarkerState, string> = {
    lieu: "background:var(--surface);border:2px solid var(--gold);color:var(--gold-ink);",
    "en-cours":
      "background:var(--crimson);border:2px solid var(--crimson-edge);color:var(--on-crimson);",
    annonce:
      "background:var(--surface);border:2px dashed var(--gold);color:var(--gold-ink);",
    selectionne:
      "background:var(--crimson);border:3px solid var(--surface);outline:2px solid var(--crimson-edge);color:var(--on-crimson);",
  };

  return `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;box-sizing:border-box;${styles[state]}"><svg width="${
    state === "selectionne" ? 18 : 15
  }" height="${
    state === "selectionne" ? 18 : 15
  }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg></span>`;
}
