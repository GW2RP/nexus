import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { lireLimite } from "@/server/api-overlay";
import { LIMITE_MAXIMALE, LIMITE_PAR_DEFAUT, scenesDuJour } from "@/server/aujourdhui";

export const dynamic = "force-dynamic";

/**
 * Les scènes du jour (`scenesDuJour`) telles que les voit le compte connecté :
 * les publiques, et les privées qu'il organise, où il est invité, où il est
 * inscrit, ou que son groupe tient. L'application bureau la demande quand elle
 * porte un jeton ; sinon, elle lit l'adresse publique.
 *
 * Une adresse à part, pas un en-tête sur la publique : celle-là est resservie
 * par le CDN, qui ne distingue pas deux lecteurs à la même adresse. Celle-ci
 * est une lecture d'accès — jamais mémorisée, jamais resservie, et 401 sans
 * session.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);
  const { corps } = await scenesDuJour(user, limite);
  return NextResponse.json(corps, { headers: { "Cache-Control": "private, no-store" } });
}
