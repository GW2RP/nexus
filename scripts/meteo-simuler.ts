/**
 * Fait tourner la simulation sans attendre la tâche planifiée, et vérifie
 * qu'elle tient debout.
 *
 *   npm run meteo:simuler            # vérifie le moteur, sans base
 *   npm run meteo:simuler -- 360     # sur 360 pas, soit trois mois
 *   npm run meteo:simuler -- --base  # avance la vraie simulation en base
 *
 * Aucun cadre de test n'est installé dans le dépôt : ce script est le filet.
 * Il cuit le terrain depuis les zones en base quand elles existent, retombe sur
 * un terrain d'essai sinon, et sort en code 1 si une assertion tombe.
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { WEATHER_CONDITIONS, type WeatherCondition } from "@/lib/domain";
import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import { connectToDatabase } from "@/lib/mongoose";
import { advanceStep, readCell, seedState } from "@/lib/weather/engine";
import {
  CELL_COUNT,
  bakeTerrain,
  cellIndexAt,
  pointInPolygon,
  type BakedTerrain,
  type ZoneShape,
} from "@/lib/weather/grid";
import {
  STEP_SLICE_LABELS,
  sliceOf,
  stepIndexAt,
  stepStart,
} from "@/lib/weather/schedule";
import { advanceWeather, bakeFromZones } from "@/server/weather/simulation";

let echecs = 0;

function verifie(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`OK     ${nom}`);
  } else {
    echecs += 1;
    console.log(`ÉCHEC  ${nom}${detail ? ` → ${detail}` : ""}`);
  }
}

/** Un terrain d'essai, quand la base n'a pas de zones. */
function terrainDEssai(): BakedTerrain {
  const rect = (l: number, t: number, r: number, b: number) => [
    { x: l * CONTINENT_WIDTH, y: t * CONTINENT_HEIGHT },
    { x: r * CONTINENT_WIDTH, y: t * CONTINENT_HEIGHT },
    { x: r * CONTINENT_WIDTH, y: b * CONTINENT_HEIGHT },
    { x: l * CONTINENT_WIDTH, y: b * CONTINENT_HEIGHT },
  ];
  const zones: ZoneShape[] = [
    { terrain: "mer", region: null, altitude: 0, points: rect(0, 0, 0.25, 1) },
    { terrain: "relief", region: "shiverpeaks", altitude: 80, points: rect(0.4, 0, 0.55, 1) },
    { terrain: "marais", region: "maguuma", altitude: 0, points: rect(0.7, 0.55, 0.95, 0.8) },
    { terrain: "aride", region: "desert", altitude: 0, points: rect(0.6, 0.05, 0.95, 0.3) },
  ];
  return bakeTerrain(zones);
}

function verifieGeometrie() {
  const carre = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  verifie("le centre d'un carré est dedans", pointInPolygon(50, 50, carre));
  verifie("un point au large est dehors", pointInPolygon(150, 50, carre) === false);
  // Un point sur une arête partagée par deux zones voisines doit appartenir à
  // exactement une des deux. Lui imposer un côté précis n'aurait aucun sens ;
  // ce qui compte est qu'il ne tombe ni dans les deux, ni dans aucune — sans
  // quoi la cuisson laisserait un trou ou compterait deux fois.
  const voisin = [
    { x: 0, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
  ];
  const surLArete = [pointInPolygon(50, 100, carre), pointInPolygon(50, 100, voisin)];
  verifie(
    "un point sur une arête partagée n'appartient qu'à une zone",
    surLArete.filter(Boolean).length === 1,
    `${surLArete.filter(Boolean).length} zones`,
  );

  const concave = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 60, y: 40 },
    { x: 0, y: 100 },
  ];
  verifie("l'encoche d'un polygone concave est dehors", pointInPolygon(50, 80, concave) === false);
  verifie("le plein d'un polygone concave est dedans", pointInPolygon(50, 20, concave));
}

function verifieHorloge() {
  // Les deux dimanches de changement d'heure en France, en 2027.
  for (const jour of ["2027-03-28", "2027-10-31"]) {
    const indexes = new Set<number>();
    for (let heure = 0; heure < 24; heure += 1) {
      indexes.add(stepIndexAt(new Date(`${jour}T${String(heure).padStart(2, "0")}:30:00Z`)));
    }
    verifie(
      `le ${jour} ne saute ni ne répète un pas`,
      indexes.size >= 4,
      `${indexes.size} pas distincts`,
    );
  }

  const index = stepIndexAt(new Date());
  verifie("un pas se retrouve depuis son début", stepIndexAt(stepStart(index)) === index);
}

async function main() {
  const args = process.argv.slice(2);
  const enBase = args.includes("--base");
  const pas = Number(args.find((arg) => /^\d+$/.test(arg)) ?? 360);

  verifieGeometrie();
  verifieHorloge();

  let terrain: BakedTerrain;
  let source: string;
  try {
    await connectToDatabase();
    terrain = await bakeFromZones();
    const dessinees = terrain.terrain.filter((value) => value !== "plaine").length;
    if (dessinees === 0) {
      terrain = terrainDEssai();
      source = "terrain d'essai (aucune zone en base)";
    } else {
      source = `zones en base (${dessinees} cellules dessinées)`;
    }
  } catch (error) {
    terrain = terrainDEssai();
    source = `terrain d'essai (base injoignable : ${(error as Error).message})`;
  }
  console.log(`\nTerrain : ${source}`);

  const comptes = new Map<string, number>();
  for (const value of terrain.terrain) comptes.set(value, (comptes.get(value) ?? 0) + 1);
  console.log(
    "Cuisson :",
    [...comptes].map(([key, value]) => `${key}=${value}`).join(" "),
    `(total ${CELL_COUNT})`,
  );

  // Deux témoins, choisis sur ce que le terrain contient réellement.
  const premiere = (cherche: string) => terrain.terrain.findIndex((value) => value === cherche);
  const candidats: [string, number][] = [
    ["mer", premiere("mer")],
    ["marais", premiere("marais")],
    ["relief", premiere("relief")],
    ["plaine", cellIndexAt(CONTINENT_WIDTH / 2, CONTINENT_HEIGHT / 2)],
  ];
  const temoins = candidats.filter(([, index]) => index >= 0);

  const depart = stepIndexAt(new Date());
  let etat = seedState(depart, terrain);
  const premierEtat = seedState(depart, terrain);

  const vues = new Set<WeatherCondition>();
  const bornes = { tmin: 999, tmax: -999, hmin: 999, hmax: -999, pmin: 9_999, pmax: -9_999 };
  let systemesVides = 0;
  let nonFini = 0;

  console.log(`\n${pas} pas :`);
  for (let i = 1; i <= pas; i += 1) {
    etat = advanceStep(etat, terrain, depart + i);
    if (etat.systems.length === 0) systemesVides += 1;

    for (let index = 0; index < CELL_COUNT; index += 1) {
      const cell = readCell(etat, index, terrain);
      if (!Number.isFinite(cell.temperature) || !Number.isFinite(cell.humidite)) nonFini += 1;
      vues.add(cell.condition);
      bornes.tmin = Math.min(bornes.tmin, cell.temperature);
      bornes.tmax = Math.max(bornes.tmax, cell.temperature);
      bornes.hmin = Math.min(bornes.hmin, cell.humidite);
      bornes.hmax = Math.max(bornes.hmax, cell.humidite);
      bornes.pmin = Math.min(bornes.pmin, cell.pression);
      bornes.pmax = Math.max(bornes.pmax, cell.pression);
    }

    if (i % Math.max(1, Math.floor(pas / 8)) === 0) {
      const index = depart + i;
      console.log(
        "  ",
        String(i).padStart(4),
        stepStart(index).toISOString().slice(0, 10),
        STEP_SLICE_LABELS[sliceOf(index)].padEnd(11),
        temoins
          .map(([nom, cellule]) => {
            const cell = readCell(etat, cellule, terrain);
            return `${nom}:${cell.condition}/${cell.temperature}°`;
          })
          .join("  "),
      );
    }
  }

  console.log("");
  verifie("aucune grandeur ne part à l'infini", nonFini === 0, `${nonFini} valeurs`);
  verifie("un système est toujours en vie", systemesVides === 0, `${systemesVides} pas à vide`);
  verifie(
    "la température reste plausible",
    bornes.tmin > -45 && bornes.tmax < 60,
    `${bornes.tmin} → ${bornes.tmax} °C`,
  );
  verifie(
    "l'humidité reste dans ses bornes",
    bornes.hmin >= 0 && bornes.hmax <= 100,
    `${bornes.hmin} → ${bornes.hmax} %`,
  );
  verifie(
    "la pression reste dans ses bornes",
    bornes.pmin > 920 && bornes.pmax < 1_090,
    `${bornes.pmin} → ${bornes.pmax} hPa`,
  );
  verifie(
    "les six conditions apparaissent",
    WEATHER_CONDITIONS.every((condition) => vues.has(condition)),
    `manque ${WEATHER_CONDITIONS.filter((c) => !vues.has(c)).join(", ") || "rien"}`,
  );

  // Le déterminisme : c'est lui qui autorise la frise de prévision à s'afficher
  // comme un bulletin plutôt que comme une promesse.
  let rejoue = premierEtat;
  for (let i = 1; i <= Math.min(pas, 40); i += 1) {
    rejoue = advanceStep(rejoue, terrain, depart + i);
  }
  let reference = seedState(depart, terrain);
  for (let i = 1; i <= Math.min(pas, 40); i += 1) {
    reference = advanceStep(reference, terrain, depart + i);
  }
  const identique = reference.cells.humidite.every(
    (value, index) => value === rejoue.cells.humidite[index],
  );
  verifie("deux passages donnent le même résultat", identique);

  if (enBase) {
    const { produced } = await advanceWeather();
    console.log(`\nEn base : ${produced.length} pas produit(s) ${produced.join(", ")}`);
    const { produced: encore } = await advanceWeather();
    verifie("un second appel ne produit rien", encore.length === 0, `${encore.length} pas`);
  }

  console.log(echecs === 0 ? "\nTout est vert." : `\n${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
