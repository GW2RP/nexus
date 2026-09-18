/**
 * Les phénomènes qu'on montre sur la carte.
 *
 * Ils ne remplacent pas la condition d'une cellule : ils la recoupent. Une
 * cellule peut être en orage **et** dans un vent fort, ou dégagée **et** en
 * forte chaleur — ce que `WEATHER_CONDITIONS`, qui ne rend qu'une valeur, ne
 * peut pas dire.
 *
 * Quand plusieurs se présentent sur la même cellule, le premier de la liste
 * l'emporte à l'affichage : l'ordre fait la règle, comme pour la condition.
 */

import type { MapTone } from "@/lib/weather/tones";
import { SEUILS, type CellReading } from "@/lib/weather/engine";

export const PHENOMENES = ["orage", "neige", "pluie", "brume", "vent", "chaleur"] as const;
export type Phenomene = (typeof PHENOMENES)[number];

export const PHENOMENE_LABELS: Record<Phenomene, string> = {
  orage: "Orage",
  neige: "Neige",
  pluie: "Pluie",
  brume: "Brume",
  vent: "Vent fort",
  chaleur: "Forte chaleur",
};

export const PHENOMENE_TONES: Record<Phenomene, MapTone> = {
  orage: "orage",
  neige: "neige",
  pluie: "pluie",
  brume: "brume",
  vent: "vent",
  chaleur: "chaleur",
};

/** Ce qui se passe sur une cellule — rien, ou plusieurs choses à la fois. */
export function phenomenesOf(cell: CellReading): Phenomene[] {
  const trouves: Phenomene[] = [];
  if (cell.condition === "orage") trouves.push("orage");
  if (cell.condition === "neige") trouves.push("neige");
  if (cell.condition === "pluie-fine") trouves.push("pluie");
  if (cell.condition === "brume") trouves.push("brume");
  // Les deux suivants ne sont pas des conditions : ils se cumulent aux autres.
  if (cell.vent >= SEUILS.ventFort) trouves.push("vent");
  if (cell.temperature >= SEUILS.forteChaleur) trouves.push("chaleur");
  return trouves;
}

/** Celui qui se dessine, quand la cellule en porte plusieurs. */
export function phenomeneDominant(cell: CellReading): Phenomene | null {
  const trouves = phenomenesOf(cell);
  return PHENOMENES.find((value) => trouves.includes(value)) ?? null;
}
