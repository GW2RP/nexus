import "server-only";

import { cache } from "react";

import {
  REGIONS,
  TERRAINS,
  WEATHER_CONDITIONS,
  type Region,
  type Terrain,
  type WeatherCondition,
} from "@/lib/domain";
import { advanceStep, readCell, type WorldState } from "@/lib/weather/engine";
import {
  PHENOMENES,
  phenomeneDominant,
  phenomenesOf,
  type Phenomene,
} from "@/lib/weather/phenomena";
import { contourDe, taches } from "@/lib/weather/contours";
import { CELL_COUNT, CELL_SIZE, cellIndexAt, type BakedTerrain } from "@/lib/weather/grid";
import { STEPS_PER_DAY, stepEnd, stepStart } from "@/lib/weather/schedule";
import { ORDRE_DAPPLICATION, TerrainZone } from "@/models/terrain-zone";
import { WeatherStep } from "@/models/weather-step";
import { connectToDatabase, toIso } from "@/server/queries/shared";
import {
  bakeFromZones,
  stateFromDocument,
  terrainFromDocument,
  type StoredStep,
} from "@/server/weather/simulation";
import { TAGS, remember } from "@/server/queries/cache";
import type {
  TerrainZoneOutline,
  WeatherArea,
  WeatherEntry,
  WeatherProbe,
} from "@/server/types";

type Loaded = { state: WorldState; terrain: BakedTerrain };

/** Le filet des lectures de météo, en secondes.
 *
 *  L'invalidation qui fait foi est l'étiquette, retirée par `/api/meteo/avancer`
 *  à chaque pas joué. Ce délai ne sert qu'au cas où un avancement passerait sans
 *  le dire — un déploiement pendant le cron, un appel manuel du script. Il est
 *  plus court que les deux heures d'un pas : au pire on relit un pas déjà lu,
 *  jamais on n'en manque un. */
const FILET_METEO = 30 * 60;

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

/** La météo en cours, une entrée par région dessinée.
 *
 *  Cachée, comme les autres lectures de météo — et c'est ici que le cache pèse
 *  le plus lourd : un pas fait 2,73 Mo, et la moindre pastille de temps sur
 *  l'accueil, une fiche de lieu ou la carte le faisait descendre d'Atlas puis
 *  dépaqueter. Six nombres par région en sortent. Le résultat ne change qu'au
 *  pas suivant, donc `/api/meteo/avancer` retire l'étiquette et rien d'autre ne
 *  la touche ; l'heure par-dessus n'est qu'un filet, au cas où un avancement
 *  passerait sans le dire. */
export const getCurrentWeather = remember(
  async function getCurrentWeather(): Promise<WeatherEntry[]> {
    const loaded = await loadCurrentStep();
    if (!loaded) return [];
    const byRegion = indexesByRegion(loaded.terrain);
    return REGIONS.map((region) => aggregate(loaded, region, byRegion.get(region) ?? [])).filter(
      (entry): entry is WeatherEntry => entry !== null,
    );
  },
  ["weather:current"],
  [TAGS.weather],
  FILET_METEO,
);

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
 * Le numéro du pas courant, et lui seul.
 *
 * Un pas fait 2,73 Mo ; son numéro fait quelques octets. Savoir *où l'on en
 * est* ne demande pas de descendre le pas entier, et c'est tout ce qu'il faut
 * pour retrouver une frise déjà jouée.
 */
const currentStepIndex = remember(
  async function currentStepIndex(): Promise<number | null> {
    await connectToDatabase();
    const doc = await WeatherStep.findOne({ cellSize: CELL_SIZE, stepsPerDay: STEPS_PER_DAY })
      .select({ stepIndex: 1 })
      .sort({ stepIndex: -1 })
      .lean();
    return typeof doc?.stepIndex === "number" ? doc.stepIndex : null;
  },
  ["weather:step-index"],
  [TAGS.weather],
  FILET_METEO,
);

type Frise = { stepIndex: number; entries: WeatherEntry[] };

/**
 * La frise d'un pas donné.
 *
 * Elle est entièrement déterminée par deux choses, et rien d'autre : le pas d'où
 * elle part et le nombre de pas demandés — le moteur est déterministe, et le
 * terrain voyage dans le pas lui-même. Les deux forment donc la clé, et **rien
 * ne l'invalide** : une frise déjà jouée ne changera jamais, il n'y a ni horloge
 * à régler ni étiquette à retirer. Le pas suivant demande simplement une autre
 * clé.
 *
 * Rejouer douze pas coûte 1,75 s à la maille de 256 px. Ce cache-ci vit dans le
 * magasin de Next, pas dans l'instance : une instance fraîche ne refait plus le
 * calcul, et la frise ne se paie qu'une fois par pas pour tout le hub.
 */
const friseDuPas = remember(
  async function friseDuPas(stepIndex: number, limit: number): Promise<Frise | null> {
    const loaded = await loadCurrentStep();
    if (!loaded) return null;

    const byRegion = indexesByRegion(loaded.terrain);
    const entries: WeatherEntry[] = [];
    let state = loaded.state;

    for (let i = 1; i <= limit; i += 1) {
      state = advanceStep(state, loaded.terrain, loaded.state.stepIndex + i);
      const projete: Loaded = { state, terrain: loaded.terrain };
      for (const region of REGIONS) {
        const entry = aggregate(projete, region, byRegion.get(region) ?? []);
        if (entry) entries.push(entry);
      }
    }

    // L'entrée porte le pas qu'elle a réellement joué, et non celui qu'on lui a
    // demandé. Les deux peuvent différer — le numéro vient d'une lecture cachée,
    // le contenu d'une lecture d'à présent —, et comme rien n'invalide cette
    // entrée, une frise vide rangée là le resterait pour toujours. Mieux vaut
    // une frise juste sous une clé fausse : l'appelant le voit et se corrige.
    return { stepIndex: loaded.state.stepIndex, entries };
  },
  ["weather:forecast"],
  [],
);

/**
 * Les pas à venir.
 *
 * Ce n'est pas une promesse : le moteur étant déterministe, rejouer le pas
 * suivant depuis l'état courant donne exactement ce que la tâche planifiée
 * écrira. Rien n'est enregistré ici.
 */
export async function getUpcomingWeather(limit = 8): Promise<WeatherEntry[]> {
  const stepIndex = await currentStepIndex();
  if (stepIndex === null) return [];

  const frise = await friseDuPas(stepIndex, limit);
  if (!frise) return [];
  if (frise.stepIndex === stepIndex) return frise.entries;

  // Notre numéro de pas était périmé. On redemande sous celui que la frise a
  // joué : l'entrée se range à la bonne clé pour les visiteurs suivants, et
  // celle-ci sert la frise qu'on a déjà plutôt que de ne rien montrer.
  const corrigee = await friseDuPas(frise.stepIndex, limit);
  return corrigee?.entries ?? frise.entries;
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
 * mesuré, les 143 360 cellules de la grille tiennent en quelques centaines de
 * sommets une fois recousues.
 */
export const getWeatherAreas = remember(
  async function getWeatherAreas(): Promise<WeatherArea[]> {
    const loaded = await loadCurrentStep();
    if (!loaded) return [];

    const parPhenomene = new Map<Phenomene, number[]>();
    const precipitations = new Map<number, number>();
    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (!loaded.terrain.region[index]) continue;
      const cell = readCell(loaded.state, index, loaded.terrain);
      // L'ordre de priorité vit dans `phenomeneDominant` : le redire ici le ferait
      // diverger au premier changement de règle.
      const dominant = phenomeneDominant(cell);
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
  },
  ["weather:areas"],
  [TAGS.weather],
  FILET_METEO,
);

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

/** Les tracés de terrain : ils ne bougent que depuis l'administration. */
export const listTerrainZones = remember(
  async function listTerrainZones(): Promise<TerrainZoneOutline[]> {
    await connectToDatabase();
    const docs = await TerrainZone.find({}).sort(ORDRE_DAPPLICATION).lean();
    return docs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      terrain: doc.terrain as Terrain,
      region: (doc.region as Region | undefined) ?? null,
      altitude: typeof doc.altitude === "number" ? doc.altitude : 0,
      points: (doc.points ?? []).map((point) => ({ x: point.x, y: point.y })),
    }));
  },
  ["weather:terrain-zones"],
  [TAGS.terrain],
);

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
 * La grille telle que le moteur la verra, cuite depuis les zones — un caractère
 * par cellule, dans l'ordre des index, portant le rang du terrain dans
 * `TERRAINS`.
 *
 * C'est ce qui rend le dessin non aveugle : une zone trop petite pour couvrir
 * le centre d'une cellule n'apparaît pas ici, donc n'existe pas pour la
 * simulation — et ça se voit à l'écran au lieu de se deviner.
 *
 * La forme compte autant que le contenu. À cette maille, la même grille en liste
 * de `{ index, terrain }` pèse 4 805 Ko ; en rangs, 140 Ko — trente-quatre fois
 * moins à descendre à chaque ouverture de l'écran. Le rang est déjà l'entier
 * écrit dans les pas stockés, donc on ne code rien de nouveau ici.
 */
export async function getBakedTerrainGrid(): Promise<string> {
  await connectToDatabase();
  const terrain = await bakeFromZones();
  const rangs = new Array<string>(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    rangs[index] = String.fromCharCode(48 + TERRAINS.indexOf(terrain.terrain[index]));
  }
  return rangs.join("");
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
