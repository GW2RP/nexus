/**
 * La grille de simulation, posée sur le continent.
 *
 * Une cellule fait 2 048 px : 81 920 / 2 048 = 40 et 114 688 / 2 048 = 56, donc
 * la grille tombe juste sur les deux dimensions, sans cellule tronquée au bord.
 *
 * La maille n'est pas choisie pour le continent mais pour la partie habitée. Le
 * rectangle du continent est très majoritairement vide : les six régions du hub
 * tiennent dans environ 22 000 × 21 000 px. À 4 096 px la Kryte entière faisait
 * trois cellules, et un marais ne pouvait pas y différer de la plaine voisine.
 * À 2 048 px elle en fait une douzaine, et la zone dessinée sert à quelque chose.
 *
 * Ce fichier ne touche ni la base ni Leaflet : il se rejoue en ligne de commande.
 */

import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import type { Region, Terrain } from "@/lib/domain";

export const CELL_SIZE = 2_048;
export const GRID_COLS = CONTINENT_WIDTH / CELL_SIZE; // 40
export const GRID_ROWS = CONTINENT_HEIGHT / CELL_SIZE; // 56
export const CELL_COUNT = GRID_COLS * GRID_ROWS; // 2 240

export type Point = { x: number; y: number };

/** Une zone telle que la simulation la lit : sa forme et ce qu'elle fait au ciel. */
export type ZoneShape = {
  terrain: Terrain;
  region: Region | null;
  altitude: number;
  points: Point[];
};

/** Le terrain cuit, une entrée par cellule, dans l'ordre des index. */
export type BakedTerrain = {
  terrain: Terrain[];
  region: (Region | null)[];
  altitude: number[];
};

export function cellColumn(index: number): number {
  return index % GRID_COLS;
}

export function cellRow(index: number): number {
  return Math.floor(index / GRID_COLS);
}

/** La cellule qui contient un point, en pixels de continent. */
export function cellIndexAt(x: number, y: number): number {
  const column = Math.min(Math.max(Math.floor(x / CELL_SIZE), 0), GRID_COLS - 1);
  const row = Math.min(Math.max(Math.floor(y / CELL_SIZE), 0), GRID_ROWS - 1);
  return row * GRID_COLS + column;
}

/** Le centre d'une cellule, en pixels de continent. */
export function cellCenter(index: number): Point {
  return {
    x: cellColumn(index) * CELL_SIZE + CELL_SIZE / 2,
    y: cellRow(index) * CELL_SIZE + CELL_SIZE / 2,
  };
}

/** Le rectangle d'une cellule, en pixels de continent — de quoi le convertir en
 *  bornes Leaflet par le `toBounds` de la carte. */
export function cellRect(index: number): { left: number; top: number; right: number; bottom: number } {
  const left = cellColumn(index) * CELL_SIZE;
  const top = cellRow(index) * CELL_SIZE;
  return { left, top, right: left + CELL_SIZE, bottom: top + CELL_SIZE };
}

/** L'index du voisin, ou `null` au bord : la grille ne s'enroule pas. */
export function neighbourIndex(index: number, dx: number, dy: number): number | null {
  const column = cellColumn(index) + dx;
  const row = cellRow(index) + dy;
  if (column < 0 || column >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return row * GRID_COLS + column;
}

/** Lancer de rayon : on compte les côtés traversés vers la droite. */
export function pointInPolygon(x: number, y: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x;
    const yi = points[i].y;
    const xj = points[j].x;
    const yj = points[j].y;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * La zone qui l'emporte en un point, ou `null` si aucune ne le couvre.
 *
 * C'est la règle de recouvrement du hub, en un seul endroit : la **dernière**
 * zone de la liste gagne. `bakeTerrain` s'en sert, et le ping de
 * l'administration aussi — ainsi ce que le ping annonce est, par construction,
 * ce que la simulation retiendra.
 */
export function zoneAt<T extends { points: Point[] }>(
  x: number,
  y: number,
  zones: readonly T[],
): T | null {
  // On remonte la liste : la première trouvée en partant de la fin *est* la
  // dernière dessinée, donc on rend la main sans tester les précédentes.
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    const zone = zones[i];
    if (zone.points.length < 3) continue;
    if (pointInPolygon(x, y, zone.points)) return zone;
  }
  return null;
}

/**
 * Le terrain de chaque cellule, déduit des zones dessinées.
 *
 * On teste le **centre** de la cellule : une zone trop petite pour couvrir un
 * centre n'existe pas pour la simulation. L'écran d'administration montre la
 * grille cuite pour que ça se voie plutôt que de se deviner.
 *
 * Quand deux zones se recouvrent, la dernière de la liste l'emporte.
 *
 * La cuisson se refait à chaque pas plutôt que de se ranger quelque part : rien
 * à invalider, donc rien qui puisse être périmé quand une zone vient d'être
 * modifiée.
 */
export function bakeTerrain(zones: ZoneShape[]): BakedTerrain {
  const terrain: Terrain[] = new Array(CELL_COUNT).fill("plaine");
  const region: (Region | null)[] = new Array(CELL_COUNT).fill(null);
  const altitude: number[] = new Array(CELL_COUNT).fill(0);

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const center = cellCenter(index);
    const zone = zoneAt(center.x, center.y, zones);
    if (!zone) continue;
    terrain[index] = zone.terrain;
    region[index] = zone.region;
    altitude[index] = zone.altitude;
  }

  return { terrain, region, altitude };
}
