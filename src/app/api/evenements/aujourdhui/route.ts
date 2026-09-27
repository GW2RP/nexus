import { NextResponse } from "next/server";

import { fromGameCivil, gameCivil } from "@/lib/game-time";
import {
  DUREE_ALENTOURS,
  formeEvenement,
  lireLimite,
  reponsePublique,
} from "@/server/api-overlay";
import { listEvents } from "@/server/queries/events";

export const dynamic = "force-dynamic";

const LIMITE_PAR_DEFAUT = 3;
/** Au-delà, ce n'est plus un extrait du jour, c'est l'agenda : il est sur le site. */
const LIMITE_MAXIMALE = 10;

/**
 * Les scènes publiques du jour, pour l'application bureau : celles qui se
 * tiennent en ce moment, puis celles qui commencent avant minuit — minuit à
 * l'heure du serveur de jeu. Quelle que soit la position : c'est l'agenda du
 * jour, pas celui d'un endroit.
 *
 * « En cours » suit la règle de l'agenda (`pasEncoreFini`) : une veillée
 * commencée hier soir et pas encore finie en fait partie. L'ordre est celui de
 * l'agenda, par heure de début, donc les scènes en cours viennent d'abord.
 * `total` compte tout le jour, pour que l'écran dise combien il en tait.
 *
 * L'adresse ne porte pas de point : tous les joueurs demandent la même, et le
 * CDN la ressert. Le délai s'arrête à minuit, sans quoi la réponse de 23 h 59
 * annoncerait encore la veille.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  const maintenant = new Date();
  const civil = gameCivil(maintenant);
  // `Date.UTC` reporte le trente-deuxième jour sur le mois suivant.
  const minuit = fromGameCivil(civil.year, civil.month, civil.day + 1, 0);

  // `to` borne le début côté base sans retirer `pasEncoreFini`, qui ne cède
  // qu'à `from` ; il est inclusif, donc le filtre strict écarte une scène
  // posée à minuit pile, qui est du lendemain.
  const scenes = (await listEvents({ viewer: null, access: "publiques", to: minuit })).filter(
    (evenement) => new Date(evenement.startsAt) < minuit,
  );

  const jour = `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;
  const jusquaMinuit = Math.max(Math.floor((minuit.getTime() - maintenant.getTime()) / 1000), 1);

  return reponsePublique(
    { jour, total: scenes.length, evenements: scenes.slice(0, limite).map(formeEvenement) },
    Math.min(DUREE_ALENTOURS, jusquaMinuit),
  );
}
