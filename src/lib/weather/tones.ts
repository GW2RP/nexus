/**
 * Les teintes des calques de carte.
 *
 * Ce sont des noms, pas des couleurs : les valeurs vivent dans `globals.css`,
 * qui les prend aux jetons. `tokens.css` est une sortie du design system et ne
 * s'édite pas à la main.
 */

import type { Terrain, WeatherCondition } from "@/lib/domain";

export const MAP_TONES = ["eau", "marais", "relief", "aride", "foret", "neutre"] as const;
export type MapTone = (typeof MAP_TONES)[number];

export const TERRAIN_TONES: Record<Terrain, MapTone> = {
  mer: "eau",
  marais: "marais",
  relief: "relief",
  foret: "foret",
  aride: "aride",
  plaine: "neutre",
};

/** Ce qui tombe du ciel se lit à la teinte : l'eau pour la pluie, le relief
 *  pour la neige et la brume qui éteignent les couleurs. */
export const CONDITION_TONES: Record<WeatherCondition, MapTone> = {
  degage: "neutre",
  nuages: "neutre",
  "pluie-fine": "eau",
  orage: "eau",
  brume: "relief",
  neige: "relief",
};
