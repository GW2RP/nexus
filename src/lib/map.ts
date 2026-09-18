/** La carte de Tyrie.
 *
 *  Les tuiles viennent du service officiel du jeu. Les dimensions ci-dessous
 *  sont celles que l'API renvoie pour le continent 1 — `continent_dims` et
 *  `max_zoom` de `https://api.guildwars2.com/v2/continents/1`. Le continent
 *  n'est pas carré : le prendre pour tel ne montre qu'un coin de la carte.
 *
 *  Leaflet les lit en `CRS.Simple`, donc les coordonnées stockées sont des
 *  pixels de continent au zoom maximal, pas des degrés.
 */

export const TILE_URL =
  process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tiles.guildwars2.com/1/1/{z}/{x}/{y}.jpg";

/** Le bloc d'attribution réservé en bas à droite de la carte. */
export const TILE_ATTRIBUTION = "Tuiles de carte © ArenaNet, LLC / NCSOFT. Hub non affilié.";

export const CONTINENT_WIDTH = 81_920;
export const CONTINENT_HEIGHT = 114_688;

/** Le zoom auquel un pixel de continent vaut un pixel de tuile.
 *
 *  L'API annonce `max_zoom: 8` pour le continent, mais c'est le zoom 7 qui porte
 *  l'échelle de `continent_dims` : au zoom 3 la grille servie fait bien 20 × 28
 *  tuiles, soit 81920/16/256 et 114688/16/256. Le zoom 8 n'est pas servi.
 *  Se tromper de référence décale tout — les pins tombent en pleine mer. */
export const COORDINATE_ZOOM = 7;

export const MAP_MIN_ZOOM = 1;
export const MAP_MAX_ZOOM = COORDINATE_ZOOM;

/** `clamped_view` de l'étage 1 : au-delà, les tuiles sont vides. */
export const CLAMPED_VIEW = {
  left: 0,
  top: 9_000,
  right: CONTINENT_WIDTH,
  bottom: 111_000,
} as const;

/** Le cœur de la Tyrie : de Rata Sum à Hoelbrak, en passant par la Lisière de
 *  Divinité, l'Arche du Lion et le Bosquet. C'est là que presque toutes les
 *  scènes se tiennent, donc c'est la vue d'ouverture. Les bornes encadrent les
 *  `continent_rect` que l'API donne pour ces cartes. */
export const DEFAULT_VIEW = {
  left: 36_000,
  top: 25_000,
  right: 56_000,
  bottom: 40_000,
} as const;

/** Le centre de la vue d'ouverture, pour les aperçus qui ne peuvent pas cadrer. */
export const DEFAULT_CENTER = {
  x: (DEFAULT_VIEW.left + DEFAULT_VIEW.right) / 2,
  y: (DEFAULT_VIEW.top + DEFAULT_VIEW.bottom) / 2,
};

/** Ramène une coordonnée dans les bornes du continent. */
export function clampX(value: number): number {
  return Math.min(Math.max(value, 0), CONTINENT_WIDTH);
}

export function clampY(value: number): number {
  return Math.min(Math.max(value, 0), CONTINENT_HEIGHT);
}
