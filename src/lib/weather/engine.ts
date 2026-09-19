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
  CELL_SIZE,
  FINESSE,
  GRID_COLS,
  GRID_ROWS,
  cellColumn,
  cellRow,
  neighbourIndex,
  type BakedTerrain,
} from "@/lib/weather/grid";
import {
  HOURS_PER_STEP,
  STEPS_PER_DAY,
  dayOfYearOfStep,
  hourOfStep,
} from "@/lib/weather/schedule";

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

/** Le nord de la bande habitée est froid, le sud chaud. */
const NORD_FROID = 1;
const SUD_CHAUD = 27;

/**
 * La bande habitée, en pixels de continent.
 *
 * Le rectangle du continent fait 114 688 px de haut, mais les six régions du hub
 * tiennent entre les lignes 12 et 21 de la grille — relevé sur les zones
 * dessinées, pas supposé. Étaler le gradient nord-sud sur tout le rectangle le
 * dépensait donc en mer vide : des Pics Glacés à Orr il ne restait que **4 °C**
 * d'écart, le maximum annuel sur les terres était de 19 °C, et « forte chaleur »
 * ne pouvait tout simplement jamais arriver.
 *
 * Le gradient s'étale sur cette bande et se borne au-delà : l'océan du nord est
 * uniformément froid, celui du sud uniformément chaud, et personne n'y habite.
 * C'est le même raisonnement que la maille de la grille — on calibre sur la
 * partie habitée, pas sur le rectangle.
 *
 * L'écart entre deux régions voisines reste modeste, et c'est voulu : le froid
 * des Pics Glacés vient de leur **altitude**, pas de leur latitude.
 */
const BANDE_NORD = 22_528;
const BANDE_SUD = 47_104;
/** L'écart entre le cœur de l'été et celui de l'hiver. */
const AMPLITUDE_SAISON = 8;
/** Un relief à 100 perd douze degrés sur la plaine. */
const REFROIDISSEMENT_MAX = 12;
/**
 * L'échelle du vent.
 *
 * Le gradient de pression entre deux cellules donne un nombre sans unité, que
 * l'interface affiche pourtant en km/h. Mesuré tel quel, ce vent plafonnait à
 * 30 km/h et valait 6 en médiane : un monde sans un souffle, et un « vent fort »
 * impossible à définir. Ce facteur remet l'échelle d'aplomb — médiane 18,
 * centile 99 à 57, pointes à 90.
 *
 * Il ne change **que le nombre affiché** : tout ce qui lit le vent pour agir
 * (advection, brume, soulèvement) divise par la même échelle, donc la physique
 * est identique à celle d'avant.
 */
const VENT_ECHELLE = 3;

/** Le vent d'ouest qui souffle en permanence. */
const VENT_DOMINANT = 6 * VENT_ECHELLE;

/** L'amplitude du jour à la nuit, en degrés de part et d'autre de la moyenne. */
const AMPLITUDE_JOUR = 4.5;

/**
 * Les coefficients ci-dessous sont calibrés pour un pas de **six heures**, la
 * cadence d'origine. Ils sont convertis à la cadence courante pour que le temps
 * se comporte pareil en heures réelles : sans cela, passer à deux heures par pas
 * rendrait le ciel trois fois plus agité, systèmes compris.
 *
 * Changer `HOURS_PER_STEP` suffit donc — rien d'autre n'est à retoucher ici.
 */
const HEURES_DE_REFERENCE = 6;
const CADENCE = HOURS_PER_STEP / HEURES_DE_REFERENCE;

/**
 * Les grandeurs **spatiales** suivent la même règle que les taux, une dimension
 * plus loin : elles sont écrites pour la maille de référence et converties à
 * celle du jour. Un rayon ou une vitesse comptés en cellules décriraient sinon
 * une dépression deux fois plus petite et deux fois plus lente dès qu'on affine
 * la grille — la finesse changerait le climat, et elle ne le doit pas.
 */
function parMaille(valeur: number): number {
  return valeur * FINESSE;
}

/** Ce qu'un front doit franchir de cellules de plus à maille fine : la fraction
 *  transportée se compose, elle ne se multiplie pas. */
function fractionParMaille(part: number): number {
  return 1 - Math.pow(1 - part, FINESSE);
}

/** Un apport ou un déplacement par pas : il se divise avec la durée. */
function parPas(parSixHeures: number): number {
  return parSixHeures * CADENCE;
}

/** Une fraction consommée par pas. Elle ne se divise pas : rendre la moitié en
 *  six heures, c'est en rendre 1 − (1 − ½)^⅓ en deux. */
function fractionParPas(parSixHeures: number): number {
  return 1 - Math.pow(1 - parSixHeures, CADENCE);
}

/** Un facteur de décroissance, qui se met à la puissance plutôt qu'au produit. */
function decroissanceParPas(parSixHeures: number): number {
  return Math.pow(parSixHeures, CADENCE);
}

/**
 * Une grandeur qui retombe vers zéro entre deux apports — la précipitation est
 * la seule du moteur.
 *
 * Elle ne se convertit ni comme un apport, ni comme une décroissance seule : ce
 * qu'il faut conserver est son **point d'équilibre**, `apport / (1 − décroissance)`,
 * et sa vitesse de retour. Diviser bêtement l'apport ferait baisser l'équilibre
 * d'un cinquième — assez pour que les orages, qui demandent une intensité de 45,
 * cessent tout simplement d'exister.
 */
function relaxe(valeur: number, decroissanceSixHeures: number, apportSixHeures: number): number {
  const d = decroissanceParPas(decroissanceSixHeures);
  return valeur * d + apportSixHeures * ((1 - d) / (1 - decroissanceSixHeures));
}

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
  const y = (cellRow(index) + 0.5) * CELL_SIZE;
  const latitude = clamp((y - BANDE_NORD) / (BANDE_SUD - BANDE_NORD), 0, 1);
  const base = NORD_FROID + (SUD_CHAUD - NORD_FROID) * latitude;

  // La saison suit le calendrier réel, pas le tyrien : le lecteur voit les deux
  // dates côte à côte, et une tempête de neige un 21 juillet ne s'explique pas.
  // Le tyrien reste l'habillage, il ne commande pas le ciel.
  const saison = Math.cos(((dayOfYearOfStep(stepIndex) - 202) / 365) * Math.PI * 2);

  const effet = EFFETS[terrain.terrain[index]];
  // Une courbe continue sur l'heure plutôt qu'une marche par tranche : à douze
  // pas par jour, un escalier de quatre marches se verrait.
  const heure = hourOfStep(stepIndex);
  const tranche =
    Math.cos(((heure - 15) / 24) * Math.PI * 2) * AMPLITUDE_JOUR * effet.amplitude;
  const altitude = (terrain.altitude[index] / 100) * REFROIDISSEMENT_MAX;

  return base + saison * AMPLITUDE_SAISON + tranche - altitude + effet.chaleur;
}

/**
 * Les seuils qui nomment le temps qu'il fait.
 *
 * Ils ne sont pas ronds par hasard : ils sont relevés sur la distribution réelle
 * du moteur. Sur les **cellules en région**, celles que la carte montre et que
 * les bulletins agrègent — pas sur tout le rectangle du continent, dont la mer
 * couvre 96 % et qui n'intéresse personne.
 *
 * C'est l'orage qui a instruit les deux fois. Posé à 45 sur les à-coups d'un pas
 * de six heures, il devenait **inatteignable** dès que les pas ont été affinés à
 * deux heures. Descendu à 20, il touchait bien 0,4 % du continent — mais 0,01 %
 * des terres, soit trois orages par an sur tout le hub : mesuré sur la mer, il
 * décrivait la mer.
 */
export const SEUILS = {
  /** En dessous, l'averse s'arrête ; au-dessus, il pleut. */
  pluie: 3,
  /**
   * Un orage est une averse **chaude**.
   *
   * L'ancienne règle demandait la coïncidence de trois grandeurs — pluie forte,
   * dépression, chaleur. Mesure faite, la pression n'y était pour rien : quand
   * il pleut fort sur les terres, sa médiane vaut 1013, la référence même, et
   * retirer la clause ne change pas un chiffre au large. Ce qui bloquait est
   * ailleurs : la saturation monte avec la température, donc une pluie forte sur
   * les terres est un évènement **froid** — 86 % des averses fortes tombaient
   * sous 8 °C, et une pluie d'hiver n'est pas un orage.
   *
   * La règle dit donc ce qu'un orage est : il pleut dru et il fait chaud. Relevé
   * sur les terres, 0,6 % des cellules-pas — une demi-cellule en orage à un
   * instant donné, l'exception qu'on remarque.
   */
  orage: 12,
  orageTemperature: 15,
  /** Il neige plutôt qu'il ne pleut. */
  gel: 1,
  /** Le ciel est couvert. */
  couverture: 45,
  /** La brume ne prend que si le vent tombe. */
  brumeVent: 27,
  /**
   * Une chaleur qui pèse, et un vent qui gêne.
   *
   * Relevés eux aussi sur les terres. 28 °C y touche 3,0 % des cellules-pas :
   * une poignée de cellules les après-midi d'été, rien l'hiver. 40 km/h en
   * touche 0,7 % — le centile 99,3 du vent des terres, et un vent qui décoiffe
   * pour de bon. Le seuil valait 50, relevé sur le continent entier : au large
   * c'est le centile 98, sur les terres le 99,8, et « vent fort » ne s'allumait
   * qu'une visite sur six.
   */
  forteChaleur: 28,
  ventFort: 40,
} as const;

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
  const rayon = parMaille(4 + randomFrom(s) * 5);
  s = nextSeed(s);
  const vx = parMaille(parPas(0.5 + randomFrom(s) * 0.7));
  s = nextSeed(s);
  const vy = parMaille(parPas((randomFrom(s) - 0.5) * 0.4));
  s = nextSeed(s);
  // En jours, pas en pas : un système vit trois à sept jours quelle que soit la
  // finesse de la simulation.
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
    const derive = parMaille(parPas((randomFrom(seed) - 0.5) * 0.18));
    const age = system.age + 1;
    const moved: PressureSystem = {
      ...system,
      x: system.x + system.vx,
      y: clamp(system.y + system.vy + derive, -2, GRID_ROWS + 2),
      // Un système s'épuise en fin de vie plutôt que de disparaître d'un coup.
      force:
        system.force *
        (age > system.vie ? decroissanceParPas(0.55) : decroissanceParPas(0.99)),
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
    ventX[index] =
      (parMaille((pression[ouest] - pression[est]) * 3) * VENT_ECHELLE + VENT_DOMINANT) * frein;
    ventY[index] = parMaille((pression[nord] - pression[sud]) * 3) * VENT_ECHELLE * frein;
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
    const part = fractionParMaille(
      fractionParPas(clamp(vitesse(vx, vy) / (60 * VENT_ECHELLE), 0, 0.6)),
    );

    humidite[index] =
      previous.cells.humidite[index] * (1 - part) + previous.cells.humidite[amont] * part;
    couverture[index] =
      previous.cells.couverture[index] * (1 - part) + previous.cells.couverture[amont] * part;

    // 5. Le terrain.
    const effet = EFFETS[terrain.terrain[index]];
    const cible = temperatureCible(index, stepIndex, terrain);
    temperature[index] =
      previous.cells.temperature[index] +
      (cible - previous.cells.temperature[index]) * fractionParPas(effet.inertie);

    // La mer n'évapore qu'à proportion de sa chaleur — et de moins en moins à
    // mesure que l'air se remplit, sinon elle finirait en orage permanent.
    const apport =
      effet.humidite > 0
        ? effet.humidite *
          clamp(0.4 + temperature[index] / 30, 0.2, 1.4) *
          clamp(1 - humidite[index] / 100, 0, 1)
        : effet.humidite;
    const apportDuPas = parPas(apport);
    humidite[index] += apportDuPas;

    // La pluie se pose en une fois plus bas : le relief fixe la vitesse à
    // laquelle elle retombe, le relief et la condensation ce qui l'alimente.
    let retombee = 0.5;
    let alimentation = 0;

    // Le relief force l'air à monter : il pleut au vent, et il sèche dessous.
    const denivele = parMaille(terrain.altitude[index] - terrain.altitude[amont]);
    if (denivele > 8) {
      const soulevement =
        (denivele / 100) * clamp(vitesse(vx, vy) / (10 * VENT_ECHELLE), 0.3, 3);
      humidite[index] -= parPas(soulevement * 6);
      couverture[index] += parPas(soulevement * 22);
      alimentation += soulevement * 15;
    } else if (denivele < -8) {
      // Le versant sous le vent reçoit un air déjà essoré.
      humidite[index] += parPas(denivele / 12);
      couverture[index] += parPas(denivele / 4);
      retombee = 0.3;
    }

    // Une dépression creuse fait monter l'air à elle seule.
    const creux = PRESSION_DE_REFERENCE - pression[index];
    if (creux > 0) {
      couverture[index] += parPas(creux * 1.6);
      humidite[index] += parPas(creux * 0.18);
    } else {
      // Sous anticyclone, le ciel se dégage et l'air s'assèche.
      couverture[index] += parPas(creux * 1.8);
      humidite[index] += parPas(creux * 0.3);
    }

    humidite[index] = clamp(humidite[index], 5, 100);

    // 6. Condensation : au-delà du seuil, l'air rend ce qu'il ne peut plus tenir.
    // En altitude l'air se détend et lâche plus tôt : un sommet s'accroche son
    // nuage même quand la plaine en dessous reste sèche.
    const seuil = saturation(temperature[index]) - (terrain.altitude[index] / 100) * 9;
    if (humidite[index] > seuil) {
      const exces = humidite[index] - seuil;
      alimentation += exces * 3;
      // L'averse vide vraiment l'air : sans quoi elle ne s'arrête jamais.
      humidite[index] -= exces * fractionParPas(0.9);
      couverture[index] += parPas(exces * 4);
    }

    couverture[index] = clamp(couverture[index], 0, 100);
    precipitation[index] = clamp(
      relaxe(previous.cells.precipitation[index], retombee, alimentation),
      0,
      100,
    );
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
  if (cell.precipitation > SEUILS.pluie && cell.temperature < SEUILS.gel) return "neige";
  if (cell.precipitation > SEUILS.orage && cell.temperature > SEUILS.orageTemperature) {
    return "orage";
  }
  if (cell.precipitation > SEUILS.pluie) return "pluie-fine";
  if (cell.humidite > (cell.seuilBrume ?? 84) && cell.vent < SEUILS.brumeVent) return "brume";
  if (cell.couverture > SEUILS.couverture) return "nuages";
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
