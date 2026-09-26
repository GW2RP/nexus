import { NextResponse } from "next/server";

import { scenesAutour } from "@/server/alentours";
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

/**
 * Les scènes publiques qui ne sont pas finies autour d'un point de la carte,
 * de la plus proche à la plus éloignée, pour l'application bureau. Depuis
 * `/api/alentours`, elle les lit avec les lieux et les rumeurs en un appel ;
 * cette route reste pour les versions installées.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const point = lirePoint(searchParams);
  if (!point) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }
  const rayon = lireRayon(searchParams);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  const evenements = await scenesAutour(point, rayon, limite);
  return reponsePublique({ ...point, rayon, evenements }, DUREE_ALENTOURS);
}
