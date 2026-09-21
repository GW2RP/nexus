import type { EventType, PlaceType } from "@/lib/domain";
import type { Phenomene } from "@/lib/weather/phenomena";

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
  domaine:
    '<path d="M2.5 13 v-5.5 h11 v5.5 M2.5 7.5 v-1.5 h2 v1.5 M6.5 7.5 v-1.5 h2 v1.5 M10.5 7.5 v-1.5 h2 v1.5 M6.8 13 v-3 h2.4 v3"/>',
  maison: '<path d="M3 8 L8 3.5 L13 8 M4.5 8 v5 h7 v-5 M7 13 v-3 h2 v3"/>',
  campement: '<path d="M2.5 13 h11 M8 3.5 L4 13 M8 3.5 L12 13 M6.3 13 l1.7 -4.3 l1.7 4.3"/>',
  rumeur: '<path d="M2.5 3.5 h11 v7 h-6.7 l-2.8 2.8 v-2.8 h-1.5 z M5.5 7 h5"/>',
};

/** Ce qu'un pin peut désigner. Une rumeur n'a pas de type à elle — elle est son
 *  propre type, et c'est son glyphe qui le dit. */
export type PinType = PlaceType | EventType | "rumeur";

export type MarkerState = "lieu" | "en-cours" | "annonce" | "rumeur" | "selectionne";

export function markerHtml(type: PinType, state: MarkerState): string {
  const glyph = GLYPHS[type] ?? GLYPHS.taverne;
  const size = state === "selectionne" ? 44 : 34;

  const styles: Record<MarkerState, string> = {
    lieu: "background:var(--surface);border:2px solid var(--gold);color:var(--gold-ink);",
    "en-cours":
      "background:var(--crimson);border:2px solid var(--crimson-edge);color:var(--on-crimson);",
    annonce:
      "background:var(--surface);border:2px dashed var(--gold);color:var(--gold-ink);",
    // Ni or ni plein : une rumeur n'est ni un lieu du registre ni une scène
    // annoncée. Le trait carmin la range du côté de ce qui se raconte.
    rumeur:
      "background:var(--surface);border:2px solid var(--crimson-edge);color:var(--crimson-ink);",
    selectionne:
      "background:var(--crimson);border:3px solid var(--surface);outline:2px solid var(--crimson-edge);color:var(--on-crimson);",
  };

  return `<span style="display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;box-sizing:border-box;${styles[state]}"><svg width="${
    state === "selectionne" ? 18 : 15
  }" height="${
    state === "selectionne" ? 18 : 15
  }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg></span>`;
}

/** Les six symboles de phénomène, repris trait pour trait de `icons.tsx` : une
 *  tache de ciel porte le même signe que sa ligne de légende. */
const PHENOMENES_GLYPHS: Record<Phenomene, string> = {
  orage:
    '<path d="M4.5 10 A2.6 2.6 0 0 1 5 5 A3.4 3.4 0 0 1 11.4 5.4 A2.3 2.3 0 0 1 11 10 Z"/><path d="M8.6 11 L6.6 13.6 h2 l-1 2"/>',
  neige: '<path d="M8 2 v12 M2.8 5 l10.4 6 M13.2 5 l-10.4 6"/>',
  pluie:
    '<path d="M4.5 10 A2.6 2.6 0 0 1 5 5 A3.4 3.4 0 0 1 11.4 5.4 A2.3 2.3 0 0 1 11 10 Z"/><path d="M6 12 l-1 2 M9 12 l-1 2"/>',
  brume: '<path d="M2.5 5.5 h11 M3.5 8 h9 M2.5 10.5 h11"/>',
  vent: '<path d="M2 5.5 h7.5 a1.8 1.8 0 1 0 -1.8 -1.8"/><path d="M2 8.5 h10 a1.8 1.8 0 1 1 -1.8 1.8"/><path d="M2 11.5 h5.5"/>',
  chaleur:
    '<circle cx="8" cy="8" r="3.2"/><path d="M8 1.4 v1.6 M8 13 v1.6 M1.4 8 h1.6 M13 8 h1.6 M3.4 3.4 l1.1 1.1 M11.5 11.5 l1.1 1.1 M12.6 3.4 l-1.1 1.1 M4.5 11.5 l-1.1 1.1"/>',
};

/** Le symbole posé au cœur d'une tache de ciel. Pas de pastille ni de cadre :
 *  la zone porte déjà sa teinte, le signe n'a qu'à la nommer. */
export function phenomeneMarkerHtml(phenomene: Phenomene): string {
  const glyph = PHENOMENES_GLYPHS[phenomene];
  return `<svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${glyph}</svg>`;
}

/** Le repère laissé par une sonde : une croix, pas un pin — on ne pose rien, on
 *  regarde. */
export function sondeMarkerHtml(): string {
  return `<svg width="26" height="26" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M8 1 v4 M8 11 v4 M1 8 h4 M11 8 h4"/><circle cx="8" cy="8" r="2.4"/></svg>`;
}
