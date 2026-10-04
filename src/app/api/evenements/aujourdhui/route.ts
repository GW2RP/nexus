import { NextResponse } from "next/server";

import { DUREE_ALENTOURS, lireLimite, reponsePublique } from "@/server/api-overlay";
import { LIMITE_MAXIMALE, LIMITE_PAR_DEFAUT, scenesDuJour } from "@/server/aujourdhui";

export const dynamic = "force-dynamic";

/**
 * Les scènes publiques du jour (`scenesDuJour`), lues sans lecteur.
 *
 * L'adresse ne porte pas de point : tous les joueurs demandent la même, et le
 * CDN la ressert. Elle ne dit donc pas qui lit, et les scènes privées passent
 * par `pour-moi`. Le délai s'arrête à minuit, sans quoi la réponse de 23 h 59
 * annoncerait encore la veille.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);
  const { corps, jusquaMinuit } = await scenesDuJour(null, limite);
  return reponsePublique(corps, Math.min(DUREE_ALENTOURS, jusquaMinuit));
}
