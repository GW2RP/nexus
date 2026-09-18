/**
 * Pose un jeu de zones de terrain de départ.
 *
 *   npm run meteo:terrains
 *
 * Les contours ne sont pas inventés : ce sont les `continent_rect` que l'API
 * officielle du jeu renvoie pour ces régions et ces cartes
 * (`/v2/continents/1/floors/1/regions`). Ce sont des rectangles, donc des
 * approximations grossières — une côte n'est pas un rectangle. Ils servent à
 * faire tourner la simulation dès le premier jour ; l'administration est censée
 * les redessiner au polygone depuis `/admin/terrains`.
 *
 * Le script vide la collection : il repart d'une base propre, comme `db:seed`.
 */

import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

import { REGIONS, TERRAINS, type Region, type Terrain } from "@/lib/domain";
import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import { connectToDatabase } from "@/lib/mongoose";
import { TerrainZone } from "@/models/terrain-zone";
import { User } from "@/models/user";

type Rect = { left: number; top: number; right: number; bottom: number };

function rectangle(rect: Rect): { x: number; y: number }[] {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ];
}

type Draft = {
  name: string;
  terrain: Terrain;
  region: Region | null;
  altitude?: number;
  rect: Rect;
};

/** L'ordre compte : la dernière zone l'emporte sur celles qu'elle recouvre. */
const DRAFTS: Draft[] = [
  // La mer d'abord, sur tout le continent : elle sert de fond, et n'appartient
  // à aucune région. Tout ce qui est dessiné après mord dedans.
  {
    name: "L'océan",
    terrain: "mer",
    region: null,
    rect: { left: 0, top: 0, right: CONTINENT_WIDTH, bottom: CONTINENT_HEIGHT },
  },

  // Les régions, d'après `continent_rect`.
  {
    name: "Kryte",
    terrain: "plaine",
    region: "kryte",
    rect: { left: 42_112, top: 25_856, right: 50_432, bottom: 36_864 },
  },
  {
    name: "Ascalon",
    terrain: "plaine",
    region: "ascalon",
    rect: { left: 56_320, top: 24_832, right: 64_512, bottom: 35_712 },
  },
  {
    name: "Chaîne des Cimefroides",
    terrain: "relief",
    region: "shiverpeaks",
    altitude: 85,
    rect: { left: 50_432, top: 24_448, right: 56_576, bottom: 37_760 },
  },
  {
    name: "Côte ternie",
    terrain: "foret",
    region: "maguuma",
    rect: { left: 37_376, top: 30_848, right: 44_032, bottom: 38_592 },
  },
  {
    name: "Ruines d'Orr",
    terrain: "marais",
    region: "orr",
    rect: { left: 42_880, top: 38_784, right: 50_560, bottom: 45_696 },
  },

  // Les cartes qui portent un terrain propre, par-dessus leur région.
  {
    name: "Collines de Kessex",
    terrain: "marais",
    region: "kryte",
    rect: { left: 42_112, top: 30_464, right: 46_208, bottom: 32_512 },
  },
  {
    name: "Forêt de Caledon",
    terrain: "foret",
    region: "maguuma",
    rect: { left: 42_112, top: 32_512, right: 44_032, bottom: 36_480 },
  },
  {
    name: "Marais de Lumillule",
    terrain: "marais",
    region: "maguuma",
    rect: { left: 48_000, top: 35_456, right: 50_560, bottom: 38_784 },
  },
  {
    name: "Marais de fer",
    terrain: "marais",
    region: "ascalon",
    rect: { left: 59_904, top: 25_856, right: 61_952, bottom: 29_952 },
  },
];

// Le Désert de Cristal est absent volontairement : l'API renvoie pour lui le
// même rectangle par défaut que pour une demi-douzaine d'autres régions, donc
// elle ne le renseigne pas. Le dessiner serait l'inventer. Tant qu'une
// administration ne l'a pas tracé, la région n'apparaît dans aucun bulletin —
// ce qui est le comportement voulu.

async function main() {
  await connectToDatabase();

  const author = await User.findOne().sort({ createdAt: 1 });
  if (!author) {
    throw new Error(
      "Aucun compte en base : inscrivez-vous une fois avant de poser les terrains.",
    );
  }

  await TerrainZone.deleteMany({});

  const created = await TerrainZone.insertMany(
    DRAFTS.map((draft) => ({
      name: draft.name,
      terrain: draft.terrain,
      region: draft.region ?? undefined,
      altitude: draft.altitude ?? 0,
      points: rectangle(draft.rect),
      authorId: String(author._id),
    })),
  );

  const parTerrain = new Map<string, number>();
  for (const draft of DRAFTS) {
    parTerrain.set(draft.terrain, (parTerrain.get(draft.terrain) ?? 0) + 1);
  }

  console.log(`${created.length} zones posées.`);
  for (const terrain of TERRAINS) {
    const count = parTerrain.get(terrain) ?? 0;
    if (count > 0) console.log(`  ${terrain} : ${count}`);
  }
  const regions = new Set(DRAFTS.map((draft) => draft.region).filter(Boolean));
  const manquantes = REGIONS.filter((region) => !regions.has(region));
  if (manquantes.length > 0) {
    console.log(`Régions sans zone : ${manquantes.join(", ")}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
