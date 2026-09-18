/**
 * Le moteur météo.
 *
 * Fonction pure : aucune base, aucun `Math.random()`. Le hasard sort d'une
 * graine rangée dans l'état et avancée à chaque pas, pour qu'un pas soit
 * rejouable à l'identique — c'est ce qui autorise la frise de `/meteo` à
 * montrer les pas à venir sans mentir : elle rejoue ce que la tâche planifiée
 * écrira.
 *
 * Un pas se déroule toujours dans le même ordre : socle saisonnier, systèmes de
 * pression, vent, advection, terrain, condensation.
 */

import type { Terrain, WeatherCondition } from "@/lib/domain";

import {
  CELL_COUNT,
  GRID_COLS,
  GRID_ROWS,
  cellColumn,
  cellRow,
  neighbourIndex,
  type BakedTerrain,
} from "@/lib/weather/grid";
import { STEPS_PER_DAY, dayOfYearOfStep, sliceOf } from "@/lib/weather/schedule";

/** Un centre de pression qui traverse le continent. C'est lui qui fait que le
 *  temps change tout seul : il naît à l'ouest, dérive, s'épuise et meurt. */
export type PressureSystem = {
  /** En colonnes et lignes de grille, en nombres à virgule. */
  x: number;
  y: number;
  /** Négatif pour une dépression, positif pour un anticyclone, en hPa. */
  force: number;
  /** Portée, en cellules. */
  rayon: number;
  vx: number;
  vy: number;
  age: number;
  vie: number;
};

export type CellField = {
  temperature: number[];
  humidite: number[];
  pression: number[];
  ventX: number[];
  ventY: number[];
  couverture: number[];
  precipitation: number[];
};

export type WorldState = {
  stepIndex: number;
  seed: number;
  systems: PressureSystem[];
  cells: CellField;
};

export type CellReading = {
  temperature: number;
  humidite: number;
  pression: number;
  vent: number;
  couverture: number;
  precipitation: number;
  visibilite: number;
  condition: WeatherCondition;
};

const PRESSION_DE_REFERENCE = 1013;

/** Le nord du continent est froid, le sud chaud. */
const NORD_FROID = 1;
const SUD_CHAUD = 27;
/** L'écart entre le cœur de l'été et celui de l'hiver. */
const AMPLITUDE_SAISON = 8;
/** Un relief à 100 perd douze degrés sur la plaine. */
const REFROIDISSEMENT_MAX = 12;
/** Le vent d'ouest qui souffle en permanence. */
const VENT_DOMINANT = 6;

/** L'écart de température propre à chaque tranche du jour. */
const AMPLITUDE_TRANCHE = { nuit: -4, matin: -1, "apres-midi": 4, soiree: 1 } as const;

/**
 * Ce que chaque terrain fait au ciel.
 *
 * `humidite` s'ajoute (ou se retranche) à chaque pas, `inertie` dit à quelle
 * vitesse la cellule rejoint sa température de fond, `freinVent` multiplie le
 * vent, `amplitude` multiplie l'écart du jour à la nuit, et `chaleur` est un
 * décalage en degrés qui ne dépend ni de la saison ni de l'heure.
 */
const EFFETS: Record<
  Terrain,
  {
    humidite: number;
    inertie: number;
    freinVent: number;
    amplitude: number;
    /** En degrés, ajouté à la température de fond. */
    chaleur: number;
  }
> = {
  // La mer nourrit l'humidité sans discontinuer et encaisse les écarts.
  mer: { humidite: 12, inertie: 0.12, freinVent: 1, amplitude: 0.3, chaleur: 0 },
  // Le marais retient ce qu'il a : c'est lui qui garde sa brume au petit matin.
  marais: { humidite: 9, inertie: 0.25, freinVent: 0.6, amplitude: 0.7, chaleur: 0 },
  // Le relief est nu et venté ; son froid vient de l'altitude, pas d'ici.
  relief: { humidite: -1, inertie: 0.4, freinVent: 1.25, amplitude: 1.1, chaleur: 0 },
  foret: { humidite: 2, inertie: 0.3, freinVent: 0.8, amplitude: 0.8, chaleur: 0 },
  // Les terres arides brûlent le jour et gèlent la nuit.
  aride: { humidite: -6, inertie: 0.45, freinVent: 1.1, amplitude: 1.8, chaleur: 0 },
  plaine: { humidite: 0, inertie: 0.35, freinVent: 1, amplitude: 1, chaleur: 0 },
  // Une rivière est une mer étroite : elle donne de l'eau à l'air et fabrique
  // sa brume au ras du lit, sans peser sur la température alentour.
  riviere: { humidite: 6, inertie: 0.28, freinVent: 0.9, amplitude: 0.85, chaleur: 0 },
  // Un lac a la masse d'eau que la rivière n'a pas : il amortit les écarts.
  lac: { humidite: 10, inertie: 0.16, freinVent: 1.05, amplitude: 0.45, chaleur: 0 },
  // Un volcan chauffe par en dessous, tout le temps, et assèche ce qui passe.
  // Son froid d'altitude, lui, vient du champ `altitude` de la zone.
  volcan: { humidite: -2, inertie: 0.5, freinVent: 1.15, amplitude: 1.2, chaleur: 6 },
  // La pierre d'une ville rend la nuit ce qu'elle a pris le jour : plus chaude
  // que la campagne voisine, moins ventée, et plus sèche.
  ville: { humidite: -1.5, inertie: 0.22, freinVent: 0.7, amplitude: 0.75, chaleur: 3 },
};

/** Générateur congruentiel : même graine, même suite, sur toutes les machines. */
function nextSeed(seed: number): number {
  return (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
}

function randomFrom(seed: number): number {
  return seed / 4_294_967_296;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** La température de fond d'une cellule : latitude, saison, tranche, altitude. */
function temperatureCible(
  index: number,
  stepIndex: number,
  terrain: BakedTerrain,
): number {
  const latitude = cellRow(index) / (GRID_ROWS - 1);
  const base = NORD_FROID + (SUD_CHAUD - NORD_FROID) * latitude;

  // La saison suit le calendrier réel, pas le tyrien : le lecteur voit les deux
  // dates côte à côte, et une tempête de neige un 21 juillet ne s'explique pas.
  // Le tyrien reste l'habillage, il ne commande pas le ciel.
  const saison = Math.cos(((dayOfYearOfStep(stepIndex) - 202) / 365) * Math.PI * 2);

  const effet = EFFETS[terrain.terrain[index]];
  const tranche = AMPLITUDE_TRANCHE[sliceOf(stepIndex)] * effet.amplitude;
  const altitude = (terrain.altitude[index] / 100) * REFROIDISSEMENT_MAX;

  return base + saison * AMPLITUDE_SAISON + tranche - altitude + effet.chaleur;
}

/** L'humidité à partir de laquelle la brume prend. Le marais la fabrique plus
 *  tôt que la plaine : c'est le sol qui rend son eau, pas seulement l'air. */
const SEUIL_BRUME: Record<Terrain, number> = {
  mer: 88,
  marais: 78,
  relief: 86,
  foret: 82,
  aride: 92,
  plaine: 84,
  // La brume de rivière se lève pour un rien, et celle d'un lac presque autant.
  riviere: 79,
  lac: 80,
  // Un volcan tient son air trop chaud pour que la brume prenne.
  volcan: 94,
  ville: 86,
};

/** Au-delà de ce seuil, l'air ne retient plus : l'air chaud porte davantage. */
function saturation(temperature: number): number {
  return clamp(62 + temperature * 1.1, 40, 96);
}

function vitesse(ventX: number, ventY: number): number {
  return Math.hypot(ventX, ventY);
}

/** Un système neuf, entré par l'ouest. */
function spawnSystem(seed: number): { system: PressureSystem; seed: number } {
  let s = nextSeed(seed);
  const y = randomFrom(s) * GRID_ROWS;
  s = nextSeed(s);
  const depression = randomFrom(s) < 0.6;
  s = nextSeed(s);
  const force = (depression ? -1 : 1) * (10 + randomFrom(s) * 18);
  s = nextSeed(s);
  const rayon = 4 + randomFrom(s) * 5;
  s = nextSeed(s);
  const vx = 0.5 + randomFrom(s) * 0.7;
  s = nextSeed(s);
  const vy = (randomFrom(s) - 0.5) * 0.4;
  s = nextSeed(s);
  const vie = STEPS_PER_DAY * (3 + Math.floor(randomFrom(s) * 5));

  return {
    system: { x: -rayon, y, force, rayon, vx, vy, age: 0, vie },
    seed: s,
  };
}

/** L'état de départ, quand aucun pas n'a encore été écrit. */
export function seedState(stepIndex: number, terrain: BakedTerrain, seed = 20_260_901): WorldState {
  let current = seed >>> 0;
  const systems: PressureSystem[] = [];
  for (let i = 0; i < 2; i += 1) {
    const spawned = spawnSystem(current);
    current = spawned.seed;
    // On les pose déjà sur le continent, sinon le premier jour est plat.
    spawned.system.x = (i + 1) * (GRID_COLS / 3);
    systems.push(spawned.system);
  }

  const cells: CellField = {
    temperature: new Array(CELL_COUNT).fill(0),
    humidite: new Array(CELL_COUNT).fill(0),
    pression: new Array(CELL_COUNT).fill(PRESSION_DE_REFERENCE),
    ventX: new Array(CELL_COUNT).fill(VENT_DOMINANT),
    ventY: new Array(CELL_COUNT).fill(0),
    couverture: new Array(CELL_COUNT).fill(0),
    precipitation: new Array(CELL_COUNT).fill(0),
  };

  for (let index = 0; index < CELL_COUNT; index += 1) {
    cells.temperature[index] = temperatureCible(index, stepIndex, terrain);
    const effet = EFFETS[terrain.terrain[index]];
    cells.humidite[index] = clamp(50 + effet.humidite * 2, 10, 95);
  }

  return { stepIndex, seed: current, systems, cells };
}

/**
 * Un pas de simulation. L'état entrant n'est jamais modifié : on rend un état
 * neuf, pour que rejouer les mêmes pas donne toujours le même résultat.
 */
export function advanceStep(
  previous: WorldState,
  terrain: BakedTerrain,
  stepIndex: number,
): WorldState {
  let seed = nextSeed(previous.seed);

  // 1. Les systèmes dérivent, vieillissent, meurent. Un nouveau prend la place.
  const systems: PressureSystem[] = [];
  for (const system of previous.systems) {
    seed = nextSeed(seed);
    const derive = (randomFrom(seed) - 0.5) * 0.18;
    const age = system.age + 1;
    const moved: PressureSystem = {
      ...system,
      x: system.x + system.vx,
      y: clamp(system.y + system.vy + derive, -2, GRID_ROWS + 2),
      // Un système s'épuise en fin de vie plutôt que de disparaître d'un coup.
      force: system.force * (age > system.vie ? 0.55 : 0.99),
      age,
    };
    if (moved.x < GRID_COLS + moved.rayon && Math.abs(moved.force) > 1.5) {
      systems.push(moved);
    }
  }
  while (systems.length < 3) {
    const spawned = spawnSystem(seed);
    seed = spawned.seed;
    systems.push(spawned.system);
  }

  // 2. Le champ de pression, somme des systèmes sur la référence.
  const pression = new Array<number>(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    let value = PRESSION_DE_REFERENCE;
    const col = cellColumn(index);
    const row = cellRow(index);
    for (const system of systems) {
      const dx = col - system.x;
      const dy = row - system.y;
      value += system.force * Math.exp(-(dx * dx + dy * dy) / (2 * system.rayon * system.rayon));
    }
    pression[index] = value;
  }

  // 3. Le vent descend la pente de pression, du haut vers le bas, plus le vent
  //    d'ouest permanent. Le terrain le freine ou l'accélère.
  const ventX = new Array<number>(CELL_COUNT);
  const ventY = new Array<number>(CELL_COUNT);
  for (let index = 0; index < CELL_COUNT; index += 1) {
    const ouest = neighbourIndex(index, -1, 0) ?? index;
    const est = neighbourIndex(index, 1, 0) ?? index;
    const nord = neighbourIndex(index, 0, -1) ?? index;
    const sud = neighbourIndex(index, 0, 1) ?? index;
    const frein = EFFETS[terrain.terrain[index]].freinVent;
    ventX[index] = ((pression[ouest] - pression[est]) * 3 + VENT_DOMINANT) * frein;
    ventY[index] = (pression[nord] - pression[sud]) * 3 * frein;
  }

  // 4. Advection : chaque cellule reçoit de sa voisine au vent. C'est ce qui
  //    fait voyager un front d'un bout à l'autre du continent.
  const humidite = new Array<number>(CELL_COUNT);
  const couverture = new Array<number>(CELL_COUNT);
  const temperature = new Array<number>(CELL_COUNT);
  const precipitation = new Array<number>(CELL_COUNT);

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const vx = ventX[index];
    const vy = ventY[index];
    const amont =
      neighbourIndex(index, vx > 0 ? -1 : vx < 0 ? 1 : 0, vy > 0 ? -1 : vy < 0 ? 1 : 0) ?? index;
    const part = clamp(vitesse(vx, vy) / 60, 0, 0.6);

    humidite[index] =
      previous.cells.humidite[index] * (1 - part) + previous.cells.humidite[amont] * part;
    couverture[index] =
      previous.cells.couverture[index] * (1 - part) + previous.cells.couverture[amont] * part;

    // 5. Le terrain.
    const effet = EFFETS[terrain.terrain[index]];
    const cible = temperatureCible(index, stepIndex, terrain);
    temperature[index] =
      previous.cells.temperature[index] +
      (cible - previous.cells.temperature[index]) * effet.inertie;

    // La mer n'évapore qu'à proportion de sa chaleur — et de moins en moins à
    // mesure que l'air se remplit, sinon elle finirait en orage permanent.
    const apport =
      effet.humidite > 0
        ? effet.humidite *
          clamp(0.4 + temperature[index] / 30, 0.2, 1.4) *
          clamp(1 - humidite[index] / 100, 0, 1)
        : effet.humidite;
    humidite[index] += apport;

    // Le relief force l'air à monter : il pleut au vent, et il sèche dessous.
    const denivele = terrain.altitude[index] - terrain.altitude[amont];
    if (denivele > 8) {
      const soulevement = (denivele / 100) * clamp(vitesse(vx, vy) / 10, 0.3, 3);
      humidite[index] -= soulevement * 6;
      couverture[index] += soulevement * 22;
      precipitation[index] = (previous.cells.precipitation[index] + soulevement * 30) / 2;
    } else if (denivele < -8) {
      // Le versant sous le vent reçoit un air déjà essoré.
      humidite[index] += denivele / 12;
      couverture[index] += denivele / 4;
      precipitation[index] = previous.cells.precipitation[index] * 0.3;
    } else {
      precipitation[index] = previous.cells.precipitation[index] * 0.5;
    }

    // Une dépression creuse fait monter l'air à elle seule.
    const creux = PRESSION_DE_REFERENCE - pression[index];
    if (creux > 0) {
      couverture[index] += creux * 1.6;
      humidite[index] += creux * 0.18;
    } else {
      // Sous anticyclone, le ciel se dégage et l'air s'assèche.
      couverture[index] += creux * 1.8;
      humidite[index] += creux * 0.3;
    }

    humidite[index] = clamp(humidite[index], 5, 100);

    // 6. Condensation : au-delà du seuil, l'air rend ce qu'il ne peut plus tenir.
    // En altitude l'air se détend et lâche plus tôt : un sommet s'accroche son
    // nuage même quand la plaine en dessous reste sèche.
    const seuil = saturation(temperature[index]) - (terrain.altitude[index] / 100) * 9;
    if (humidite[index] > seuil) {
      const exces = humidite[index] - seuil;
      precipitation[index] = clamp(precipitation[index] + exces * 3, 0, 100);
      // L'averse vide vraiment l'air : sans quoi elle ne s'arrête jamais.
      humidite[index] -= exces * 0.9;
      couverture[index] += exces * 4;
    }

    couverture[index] = clamp(couverture[index], 0, 100);
    precipitation[index] = clamp(precipitation[index], 0, 100);
    // Sous le seuil, une averse s'arrête pour de bon.
    if (precipitation[index] < 3) precipitation[index] = 0;
  }

  return {
    stepIndex,
    seed,
    systems,
    cells: { temperature, humidite, pression, ventX, ventY, couverture, precipitation },
  };
}

/** Ce qu'on voit, quand tout a été calculé. */
export function readCell(
  state: WorldState,
  index: number,
  terrain?: BakedTerrain,
): CellReading {
  const temperature = state.cells.temperature[index];
  const humidite = state.cells.humidite[index];
  const precipitation = state.cells.precipitation[index];
  const couverture = state.cells.couverture[index];
  const vent = vitesse(state.cells.ventX[index], state.cells.ventY[index]);
  const pression = state.cells.pression[index];
  const condition = conditionOf({
    temperature,
    humidite,
    precipitation,
    couverture,
    vent,
    pression,
    seuilBrume: terrain ? SEUIL_BRUME[terrain.terrain[index]] : SEUIL_BRUME.plaine,
  });

  return {
    temperature: Math.round(temperature),
    humidite: Math.round(humidite),
    pression: Math.round(pression),
    vent: Math.round(vent),
    couverture: Math.round(couverture),
    precipitation: Math.round(precipitation),
    visibilite: visibiliteOf(condition, precipitation, couverture),
    condition,
  };
}

/** La condition affichée se déduit des grandeurs : elle n'est jamais décidée. */
export function conditionOf(cell: {
  temperature: number;
  humidite: number;
  precipitation: number;
  couverture: number;
  vent: number;
  pression: number;
  seuilBrume?: number;
}): WeatherCondition {
  // L'ordre fait la règle : sans lui la neige deviendrait de la pluie fine.
  if (cell.precipitation > 3 && cell.temperature < 1) return "neige";
  if (cell.precipitation > 45 && cell.pression < 1006 && cell.temperature > 8) return "orage";
  if (cell.precipitation > 3) return "pluie-fine";
  if (cell.humidite > (cell.seuilBrume ?? 84) && cell.vent < 9) return "brume";
  if (cell.couverture > 45) return "nuages";
  return "degage";
}

/** En pourcentage : 100, on voit jusqu'à l'horizon. */
export function visibiliteOf(
  condition: WeatherCondition,
  precipitation: number,
  couverture: number,
): number {
  if (condition === "brume") return 15;
  if (condition === "neige") return Math.round(clamp(60 - precipitation * 0.5, 20, 60));
  if (condition === "orage") return Math.round(clamp(55 - precipitation * 0.3, 25, 55));
  if (condition === "pluie-fine") return Math.round(clamp(90 - precipitation, 50, 90));
  return Math.round(clamp(100 - couverture * 0.15, 80, 100));
}
