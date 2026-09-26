import { NextResponse } from "next/server";

import { lieuxAutour, regionDe, rumeursDe, scenesAutour } from "@/server/alentours";
import {
  DUREE_ALENTOURS,
  LIMITE_MAXIMALE,
  LIMITE_PAR_DEFAUT,
  lireLimite,
  lirePoint,
  lireRayon,
  reponsePublique,
} from "@/server/api-overlay";

export const dynamic = "force-dynamic";

const RUMEURS_PAR_DEFAUT = 5;

/**
 * Tout ce qu'il y a autour d'un point, en une lecture : les lieux, les scènes
 * publiques non finies, la région et ses dernières rumeurs.
 *
 * L'application bureau les montre ensemble et les redemandait en trois appels ;
 * ce sont les mêmes calculs que `/api/lieux/proximite`,
 * `/api/evenements/proximite` et `/api/rumeurs?x&y`, qui restent pour les
 * versions déjà installées. `limite` borne les lieux et les scènes, `rumeurs`
 * les rumeurs.
 *
 * La réponse porte un `Cache-Control` que le CDN honore : l'application demande
 * un point arrondi, donc deux personnages au même endroit reçoivent la même
 * réponse sans que le hub la recalcule.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const point = lirePoint(searchParams);
  if (!point) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }
  const rayon = lireRayon(searchParams);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);
  const nombreDeRumeurs = lireLimite(searchParams, RUMEURS_PAR_DEFAUT, LIMITE_MAXIMALE, "rumeurs");

  const [lieux, evenements, { region, rumeurs }] = await Promise.all([
    lieuxAutour(point, rayon, limite),
    scenesAutour(point, rayon, limite),
    regionDe(point).then(async (region) => ({
      region,
      rumeurs: await rumeursDe(region, nombreDeRumeurs),
    })),
  ]);

  return reponsePublique({ ...point, rayon, lieux, evenements, region, rumeurs }, DUREE_ALENTOURS);
}
