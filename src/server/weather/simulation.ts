import "server-only";

import { REGIONS, TERRAINS, type Region, type Terrain } from "@/lib/domain";
import { advanceStep, seedState, type WorldState } from "@/lib/weather/engine";
import {
  CELL_COUNT,
  CELL_SIZE,
  bakeTerrain,
  type BakedTerrain,
  type ZoneShape,
} from "@/lib/weather/grid";
import { PACK_SCALE_TEMPERATURE, packInt16, packScaled, unpackInt16, unpackScaled } from "@/lib/weather/pack";
import { STEPS_PER_DAY, stepEnd, stepIndexAt, stepStart } from "@/lib/weather/schedule";
import { ORDRE_DAPPLICATION, TerrainZone } from "@/models/terrain-zone";
import { WeatherStep, type WeatherStepDocument } from "@/models/weather-step";
import { connectToDatabase } from "@/server/queries/shared";

/** Au-delà, on ne rattrape pas pas à pas : la fonction expirerait. La règle est
 *  en jours, donc le plafond se déduit de la cadence — sans quoi il faudrait
 *  penser à le retoucher à chaque fois qu'elle change. */
const RATTRAPAGE_JOURS = 3;
const RATTRAPAGE_MAX = RATTRAPAGE_JOURS * STEPS_PER_DAY;

/**
 * Une semaine d'historique, et pas trente jours.
 *
 * Un pas pèse 701 Ko à la maille de 512 px, contre 176 Ko à 1 024 : trente jours
 * de conservation passaient de 62 à 246 Mo, pour des documents que rien ne relit.
 * L'avancement reprend toujours le **dernier** pas écrit, et la prévision se
 * rejoue en avant depuis lui ; un pas vieux de plus de trois jours ne peut même
 * plus servir à rattraper, le plafond de rattrapage étant là. Ce qui reste
 * derrière est une archive, et une semaine d'archive coûte 57 Mo.
 */
const RETENTION_JOURS = 7;

export type StoredStep = WeatherStepDocument & { _id: unknown };

/**
 * Le terrain, cuit depuis les zones dessinées.
 *
 * On le refait à chaque avancement plutôt que de le ranger quelque part : rien
 * à invalider, donc rien qui puisse être périmé quand une zone vient d'être
 * modifiée.
 */
export async function bakeFromZones(): Promise<BakedTerrain> {
  const docs = await TerrainZone.find({}).sort(ORDRE_DAPPLICATION).lean();
  const zones: ZoneShape[] = docs.map((doc) => ({
    terrain: doc.terrain as Terrain,
    region: (doc.region as Region | undefined) ?? null,
    altitude: typeof doc.altitude === "number" ? doc.altitude : 0,
    points: (doc.points ?? []).map((point) => ({ x: point.x, y: point.y })),
  }));
  return bakeTerrain(zones);
}

/** L'état du monde, relu depuis un pas rangé en base. */
export function stateFromDocument(doc: StoredStep): WorldState {
  return {
    stepIndex: doc.stepIndex,
    seed: doc.seed,
    systems: (doc.systems ?? []).map((system) => ({ ...system })),
    cells: {
      temperature: unpackScaled(doc.temperature, CELL_COUNT, PACK_SCALE_TEMPERATURE),
      humidite: unpackInt16(doc.humidite, CELL_COUNT),
      pression: unpackInt16(doc.pression, CELL_COUNT),
      ventX: unpackInt16(doc.ventX, CELL_COUNT),
      ventY: unpackInt16(doc.ventY, CELL_COUNT),
      couverture: unpackInt16(doc.couverture, CELL_COUNT),
      precipitation: unpackInt16(doc.precipitation, CELL_COUNT),
    },
  };
}

/** Le terrain tel qu'il était au moment du pas, relu depuis le pas lui-même. */
export function terrainFromDocument(doc: StoredStep): BakedTerrain {
  const terrainIndexes = unpackInt16(doc.terrain, CELL_COUNT);
  const regionIndexes = unpackInt16(doc.region, CELL_COUNT);
  return {
    terrain: terrainIndexes.map((index) => TERRAINS[index] ?? "plaine"),
    region: regionIndexes.map((index) => (index >= 0 ? (REGIONS[index] ?? null) : null)),
    altitude: unpackInt16(doc.altitude, CELL_COUNT),
  };
}

function documentFrom(state: WorldState, terrain: BakedTerrain) {
  return {
    stepIndex: state.stepIndex,
    stepsPerDay: STEPS_PER_DAY,
    cellSize: CELL_SIZE,
    startsAt: stepStart(state.stepIndex),
    endsAt: stepEnd(state.stepIndex),
    seed: state.seed,
    systems: state.systems,
    temperature: packScaled(state.cells.temperature, PACK_SCALE_TEMPERATURE),
    humidite: packInt16(state.cells.humidite),
    pression: packInt16(state.cells.pression),
    ventX: packInt16(state.cells.ventX),
    ventY: packInt16(state.cells.ventY),
    couverture: packInt16(state.cells.couverture),
    precipitation: packInt16(state.cells.precipitation),
    terrain: packInt16(terrain.terrain.map((value) => TERRAINS.indexOf(value))),
    region: packInt16(terrain.region.map((value) => (value ? REGIONS.indexOf(value) : -1))),
    altitude: packInt16(terrain.altitude),
  };
}

/**
 * Fait avancer la simulation jusqu'au pas dû.
 *
 * L'heure de déclenchement n'entre pas en ligne de compte : on lit l'horloge du
 * serveur de jeu et on en déduit le pas attendu. Une tâche planifiée qui part
 * une heure trop tôt ne fait donc rien, et celle qui part en retard rattrape.
 *
 * L'écriture passe par un `updateOne` en `upsert` sur `stepIndex`, qui est
 * unique : deux déclenchements simultanés ne peuvent pas écrire deux fois le
 * même pas. Et comme le moteur est déterministe, ils auraient de toute façon
 * produit les mêmes octets.
 */
export async function advanceWeather(
  options: { now?: Date; maxSteps?: number } = {},
): Promise<{ produced: number[] }> {
  await connectToDatabase();

  const now = options.now ?? new Date();
  const cible = stepIndexAt(now);
  const maxSteps = options.maxSteps ?? RATTRAPAGE_MAX;

  // Le dernier pas **de notre grille**, et rien d'autre. Un battement horaire
  // pour des pas de deux heures fait qu'un appel sur deux n'a rien à produire :
  // celui-là doit rendre la main sur une seule lecture, sans cuire le terrain ni
  // écrire une ligne.
  //
  // Le filtre est dans la requête plutôt qu'après coup : un pas d'une autre
  // cadence ou d'une autre maille est illisible, mais s'il se trouve porter un
  // numéro plus haut — un retour en arrière sur la maille, à cadence égale — le
  // jeter après l'avoir lu ferait repartir la simulation de zéro alors qu'un
  // pas compatible l'attendait juste en dessous.
  const dernier = await WeatherStep.findOne({ stepsPerDay: STEPS_PER_DAY, cellSize: CELL_SIZE })
    .sort({ stepIndex: -1 })
    .lean();

  if (dernier && dernier.stepIndex >= cible) return { produced: [] };

  const terrain = await bakeFromZones();

  // Ici seulement : l'appel qui n'a rien à produire n'aura rien écrit.
  const perimes = await WeatherStep.deleteMany({
    $or: [{ stepsPerDay: { $ne: STEPS_PER_DAY } }, { cellSize: { $ne: CELL_SIZE } }],
  });
  if (perimes.deletedCount > 0) {
    console.info(
      `Grille changée : ${perimes.deletedCount} pas d'une autre cadence ou maille retirés, la simulation repart.`,
    );
  }

  if (!dernier) {
    // Rien en base : on amorce le monde sur le pas courant.
    const amorce = seedState(cible, terrain);
    await WeatherStep.updateOne(
      { stepIndex: cible },
      { $setOnInsert: documentFrom(amorce, terrain) },
      { upsert: true },
    );
    return { produced: [cible] };
  }

  let state: WorldState = stateFromDocument(dernier as StoredStep);
  let depart = dernier.stepIndex;

  // Une absence longue ne se rejoue pas pas à pas : on reprend le fil plus près.
  if (cible - depart > maxSteps) depart = cible - maxSteps;

  const produced: number[] = [];
  for (let index = depart + 1; index <= cible; index += 1) {
    state = advanceStep(state, terrain, index);
    await WeatherStep.updateOne(
      { stepIndex: index },
      { $setOnInsert: documentFrom(state, terrain) },
      { upsert: true },
    );
    produced.push(index);
  }

  if (produced.length > 0) {
    const limite = new Date(Date.now() - RETENTION_JOURS * 86_400_000);
    await WeatherStep.deleteMany({ endsAt: { $lt: limite } });
  }

  return { produced };
}
