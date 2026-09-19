import "server-only";

import { cache } from "react";

import { REGIONS, WEATHER_CONDITIONS, type Region, type Terrain, type WeatherCondition } from "@/lib/domain";
import { advanceStep, readCell, type WorldState } from "@/lib/weather/engine";
import { PHENOMENES, phenomenesOf, type Phenomene } from "@/lib/weather/phenomena";
import { contourDe, taches } from "@/lib/weather/contours";
import { CELL_COUNT, CELL_SIZE, cellIndexAt, type BakedTerrain } from "@/lib/weather/grid";
import { STEPS_PER_DAY, stepEnd, stepStart } from "@/lib/weather/schedule";
import { TerrainZone } from "@/models/terrain-zone";
import { WeatherStep } from "@/models/weather-step";
import { connectToDatabase, toIso } from "@/server/queries/shared";
import {
  bakeFromZones,
  stateFromDocument,
  terrainFromDocument,
  type StoredStep,
} from "@/server/weather/simulation";
import type {
  TerrainZoneOutline,
  WeatherArea,
  WeatherEntry,
  WeatherProbe,
} from "@/server/types";

type Loaded = { state: WorldState; terrain: BakedTerrain };

/**
 * Le dernier pas écrit, dépaqueté une seule fois par rendu de page.
 *
 * La lecture filtre sur la maille et la cadence courantes. L'avancement purge
 * bien les pas d'une autre grille, mais il ne passe qu'une fois par heure : entre
 * un déploiement qui change la maille et le cron suivant, le dernier pas en base
 * est illisible, et `unpackInt16` lèverait sur chaque page du hub. Mieux vaut
 * n'afficher aucune météo qu'en afficher une fausse — ou planter.
 */
const loadCurrentStep = cache(async (): Promise<Loaded | null> => {
  await connectToDatabase();
  const doc = await WeatherStep.findOne({ cellSize: CELL_SIZE, stepsPerDay: STEPS_PER_DAY })
    .sort({ stepIndex: -1 })
    .lean();
  if (!doc) return null;
  const stored = doc as StoredStep;
  return { state: stateFromDocument(stored), terrain: terrainFromDocument(stored) };
});

/** La moyenne des cellules d'une région, et la condition qui y domine. */
function aggregate(
  loaded: Loaded,
  region: Region,
  indexes: number[],
): WeatherEntry | null {
  if (indexes.length === 0) return null;

  const totals = { temperature: 0, humidite: 0, pression: 0, vent: 0, visibilite: 0, precipitation: 0 };
  const votes = new Map<WeatherCondition, number>();

  for (const index of indexes) {
    const cell = readCell(loaded.state, index, loaded.terrain);
    totals.temperature += cell.temperature;
    totals.humidite += cell.humidite;
    totals.pression += cell.pression;
    totals.vent += cell.vent;
    totals.visibilite += cell.visibilite;
    totals.precipitation += cell.precipitation;
    votes.set(cell.condition, (votes.get(cell.condition) ?? 0) + 1);
  }

  // À égalité, l'ordre de l'énumération tranche : le résultat ne dépend jamais
  // de l'ordre de parcours des cellules.
  let condition: WeatherCondition = WEATHER_CONDITIONS[0];
  let best = -1;
  for (const candidate of WEATHER_CONDITIONS) {
    const count = votes.get(candidate) ?? 0;
    if (count > best) {
      best = count;
      condition = candidate;
    }
  }

  const count = indexes.length;
  const { stepIndex } = loaded.state;
  return {
    id: `${stepIndex}:${region}`,
    stepIndex,
    region,
    condition,
    temperature: Math.round(totals.temperature / count),
    humidite: Math.round(totals.humidite / count),
    pression: Math.round(totals.pression / count),
    vent: Math.round(totals.vent / count),
    visibilite: Math.round(totals.visibilite / count),
    precipitation: Math.round(totals.precipitation / count),
    startsAt: stepStart(stepIndex).toISOString(),
    endsAt: stepEnd(stepIndex).toISOString(),
  };
}

function indexesByRegion(terrain: BakedTerrain): Map<Region, number[]> {
  const byRegion = new Map<Region, number[]>();
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const region = terrain.region[index];
    if (!region) continue;
    const list = byRegion.get(region);
    if (list) list.push(index);
    else byRegion.set(region, [index]);
  }
  return byRegion;
}

/** La météo en cours, une entrée par région dessinée. */
export async function getCurrentWeather(): Promise<WeatherEntry[]> {
  const loaded = await loadCurrentStep();
  if (!loaded) return [];
  const byRegion = indexesByRegion(loaded.terrain);
  return REGIONS.map((region) => aggregate(loaded, region, byRegion.get(region) ?? [])).filter(
    (entry): entry is WeatherEntry => entry !== null,
  );
}

export const getWeatherForRegion = cache(async (region: Region): Promise<WeatherEntry | null> => {
  const loaded = await loadCurrentStep();
  if (!loaded) return null;
  return aggregate(loaded, region, indexesByRegion(loaded.terrain).get(region) ?? []);
});

/**
 * Le temps de la cellule qui contient ce point : la brume d'un marais n'est
 * plus celle de la région entière.
 *
 * La région passée en second est celle que le contenu déclare, et c'est elle qui
 * s'affiche. Celle de la cellule ne sert pas d'étiquette : un lieu posé à la
 * frontière tomberait sinon dans la région voisine, et sa fiche se
 * contredirait.
 */
export const getWeatherAt = cache(
  async (point: { x: number; y: number }, region: Region): Promise<WeatherEntry | null> => {
    const loaded = await loadCurrentStep();
    if (!loaded) return null;
    return aggregate(loaded, region, [cellIndexAt(point.x, point.y)]);
  },
);

/**
 * Les pas à venir.
 *
 * Ce n'est pas une promesse : le moteur étant déterministe, rejouer le pas
 * suivant depuis l'état courant donne exactement ce que la tâche planifiée
 * écrira. Rien n'est enregistré ici.
 */
export async function getUpcomingWeather(limit = 8): Promise<WeatherEntry[]> {
  const loaded = await loadCurrentStep();
  if (!loaded) return [];

  const byRegion = indexesByRegion(loaded.terrain);
  const entries: WeatherEntry[] = [];
  let state = loaded.state;

  for (let i = 1; i <= limit; i += 1) {
    const stepIndex = loaded.state.stepIndex + i;
    state = advanceStep(state, loaded.terrain, stepIndex);
    const projete: Loaded = { state, terrain: loaded.terrain };
    for (const region of REGIONS) {
      const entry = aggregate(projete, region, byRegion.get(region) ?? []);
      if (entry) entries.push(entry);
    }
  }

  return entries;
}

/**
 * Les taches de ciel, prêtes à dessiner.
 *
 * Un ciel dégagé ne se dessine pas — mais une cellule dégagée peut porter une
 * forte chaleur ou un vent fort, donc le tri se fait sur les phénomènes, pas sur
 * la condition. Une cellule ne porte qu'une teinte, celle du phénomène qui
 * l'emporte, donc elle n'entre que dans une tache.
 *
 * Le contour se calcule ici plutôt qu'au navigateur : c'est de la géométrie
 * pure, et une tache pèse bien moins que les cellules qui la composent —
 * mesuré, les 8 960 cellules de la grille tiennent en quelques dizaines de
 * sommets une fois recousues.
 */
export async function getWeatherAreas(): Promise<WeatherArea[]> {
  const loaded = await loadCurrentStep();
  if (!loaded) return [];

  const parPhenomene = new Map<Phenomene, number[]>();
  const precipitations = new Map<number, number>();
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (!loaded.terrain.region[index]) continue;
    const cell = readCell(loaded.state, index, loaded.terrain);
    const portes = phenomenesOf(cell);
    if (portes.length === 0) continue;
    const dominant = PHENOMENES.find((value) => portes.includes(value));
    if (!dominant) continue;
    precipitations.set(index, cell.precipitation);
    const liste = parPhenomene.get(dominant);
    if (liste) liste.push(index);
    else parPhenomene.set(dominant, [index]);
  }

  const zones: WeatherArea[] = [];
  for (const phenomene of PHENOMENES) {
    const cellules = parPhenomene.get(phenomene);
    if (!cellules) continue;
    for (const tache of taches(cellules)) {
      const contour = contourDe(tache);
      if (contour.anneaux.length === 0) continue;
      const pluie =
        tache.reduce((somme, index) => somme + (precipitations.get(index) ?? 0), 0) / tache.length;
      zones.push({
        id: `${phenomene}-${tache[0]}`,
        phenomene,
        anneaux: contour.anneaux,
        centre: contour.centre,
        cellules: contour.cellules,
        precipitation: Math.round(pluie),
      });
    }
  }
  return zones;
}

/**
 * Le temps en un point précis de la carte.
 *
 * La région est celle de la cellule — contrairement à une fiche, qui déclare la
 * sienne : on sonde un point, pas un contenu, donc il n'y a rien à respecter.
 * Une cellule hors région rend `null`, et l'écran le dit plutôt que d'inventer.
 */
export async function getWeatherProbe(x: number, y: number): Promise<WeatherProbe | null> {
  const loaded = await loadCurrentStep();
  if (!loaded) return null;

  const index = cellIndexAt(x, y);
  const cell = readCell(loaded.state, index, loaded.terrain);
  return {
    x,
    y,
    region: loaded.terrain.region[index],
    terrain: loaded.terrain.terrain[index],
    condition: cell.condition,
    phenomenes: phenomenesOf(cell),
    temperature: cell.temperature,
    humidite: cell.humidite,
    pression: cell.pression,
    vent: cell.vent,
    visibilite: cell.visibilite,
    precipitation: cell.precipitation,
    stepIndex: loaded.state.stepIndex,
  };
}

export async function listTerrainZones(): Promise<TerrainZoneOutline[]> {
  await connectToDatabase();
  const docs = await TerrainZone.find({}).sort({ createdAt: 1 }).lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    terrain: doc.terrain as Terrain,
    region: (doc.region as Region | undefined) ?? null,
    altitude: typeof doc.altitude === "number" ? doc.altitude : 0,
    points: (doc.points ?? []).map((point) => ({ x: point.x, y: point.y })),
  }));
}

export const getTerrainZone = cache(async (id: string): Promise<TerrainZoneOutline | null> => {
  await connectToDatabase();
  const doc = await TerrainZone.findById(id).lean();
  if (!doc) return null;
  return {
    id: String(doc._id),
    name: doc.name,
    terrain: doc.terrain as Terrain,
    region: (doc.region as Region | undefined) ?? null,
    altitude: typeof doc.altitude === "number" ? doc.altitude : 0,
    points: (doc.points ?? []).map((point) => ({ x: point.x, y: point.y })),
  };
});

/**
 * La grille telle que le moteur la verra, cuite depuis les zones.
 *
 * C'est ce qui rend le dessin non aveugle : une zone trop petite pour couvrir
 * le centre d'une cellule n'apparaît pas ici, donc n'existe pas pour la
 * simulation — et ça se voit à l'écran au lieu de se deviner.
 */
export async function getBakedTerrainCells(): Promise<{ index: number; terrain: Terrain }[]> {
  await connectToDatabase();
  const terrain = await bakeFromZones();
  const cells: { index: number; terrain: Terrain }[] = [];
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (terrain.terrain[index] === "plaine") continue;
    cells.push({ index, terrain: terrain.terrain[index] });
  }
  return cells;
}

/** Le pas courant, pour l'écran d'administration. */
export async function getSimulationStatus(): Promise<{
  stepIndex: number;
  startsAt: string;
  endsAt: string;
  systems: number;
  zones: number;
  cellsWithRegion: number;
} | null> {
  await connectToDatabase();
  const doc = await WeatherStep.findOne({}).sort({ stepIndex: -1 }).lean();
  if (!doc) return null;
  const stored = doc as StoredStep;
  const terrain = terrainFromDocument(stored);
  return {
    stepIndex: stored.stepIndex,
    startsAt: toIso(stored.startsAt),
    endsAt: toIso(stored.endsAt),
    systems: (stored.systems ?? []).length,
    zones: await TerrainZone.countDocuments({}),
    cellsWithRegion: terrain.region.filter(Boolean).length,
  };
}
