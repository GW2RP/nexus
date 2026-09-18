/** La carte de Tyrie.
 *
 *  Les tuiles viennent du service officiel du jeu. Un continent fait 32 768 px
 *  de côté au zoom maximal ; Leaflet les lit en `CRS.Simple`, donc les
 *  coordonnées stockées sont des pixels de continent, pas des degrés.
 */

export const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tiles.guildwars2.com/1/1/{z}/{x}/{y}.jpg";

/** Le bloc d'attribution réservé en bas à droite de la carte. */
export const TILE_ATTRIBUTION =
  "Tuiles de carte © ArenaNet, LLC / NCSOFT. Hub non affilié.";

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = 7;
export const CONTINENT_SIZE = 32768;

/** Le centre par défaut : la Kryte, là où la plupart des scènes se tiennent. */
export const DEFAULT_CENTER = { x: 17_500, y: 15_500 };
export const DEFAULT_ZOOM = 3;

/** Ramène une coordonnée de continent dans les bornes de la carte. */
export function clampToContinent(value: number): number {
  return Math.min(Math.max(value, 0), CONTINENT_SIZE);
}
