/**
 * Les teintes des calques de carte.
 *
 * Ce sont des noms, pas des couleurs : les valeurs vivent dans `globals.css`,
 * qui les prend aux jetons. `tokens.css` est une sortie du design system et ne
 * s'édite pas à la main.
 */

import type { Terrain, WeatherCondition } from "@/lib/domain";

export const MAP_TONES = [
  // Les terrains.
  "eau",
  "marais",
  "relief",
  "aride",
  "foret",
  "feu",
  "bati",
  "neutre",
  // Les phénomènes météo, qui ont leurs propres teintes : les confondre avec
  // celles du terrain rendrait les deux calques illisibles ensemble.
  "orage",
  "neige",
  "pluie",
  "brume",
  "vent",
  "chaleur",
] as const;
export type MapTone = (typeof MAP_TONES)[number];

export const TERRAIN_TONES: Record<Terrain, MapTone> = {
  mer: "eau",
  marais: "marais",
  relief: "relief",
  foret: "foret",
  aride: "aride",
  plaine: "neutre",
  riviere: "eau",
  lac: "eau",
  volcan: "feu",
  ville: "bati",
};

/** Ce qui tombe du ciel se lit à la teinte. */
export const CONDITION_TONES: Record<WeatherCondition, MapTone> = {
  degage: "neutre",
  nuages: "neutre",
  "pluie-fine": "pluie",
  orage: "orage",
  brume: "brume",
  neige: "neige",
};
