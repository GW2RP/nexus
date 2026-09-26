import { NextResponse } from "next/server";

import { lieuxAutour } from "@/server/alentours";
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
 * Les lieux du registre autour d'un point de la carte, du plus proche au plus
 * éloigné.
 *
 * Une lecture publique, comme le relevé de météo : le registre des lieux l'est
 * déjà, et cette route n'en montre rien de plus — seulement l'ordre des
 * distances. Elle existe pour l'application bureau, qui connaît la position du
 * personnage joué et ne peut pas faire descendre tout le registre pour trier
 * elle-même. Depuis `/api/alentours`, l'application les lit avec les scènes et
 * les rumeurs en un appel ; cette route reste pour les versions installées.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const point = lirePoint(searchParams);
  if (!point) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }
  const rayon = lireRayon(searchParams);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  const lieux = await lieuxAutour(point, rayon, limite);
  return reponsePublique({ ...point, rayon, lieux }, DUREE_ALENTOURS);
}
