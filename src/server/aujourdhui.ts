import "server-only";

import { fromGameCivil, gameCivil } from "@/lib/game-time";
import type { SessionUser } from "@/lib/session";
import { formeEvenement } from "@/server/api-overlay";
import { listEvents } from "@/server/queries/events";

export const LIMITE_PAR_DEFAUT = 3;
/** Au-delà, ce n'est plus un extrait du jour, c'est l'agenda : il est sur le site. */
export const LIMITE_MAXIMALE = 10;

/**
 * Les scènes du jour, pour l'application bureau : celles qui se tiennent en ce
 * moment, puis celles qui commencent avant minuit — minuit à l'heure du
 * serveur de jeu. Quelle que soit la position : c'est l'agenda du jour, pas
 * celui d'un endroit.
 *
 * « En cours » suit la règle de l'agenda (`pasEncoreFini`) : une veillée
 * commencée hier soir et pas encore finie en fait partie. L'ordre est celui de
 * l'agenda, par heure de début, donc les scènes en cours viennent d'abord.
 * `total` compte tout le jour, pour que l'écran dise combien il en tait.
 *
 * Sans lecteur, les scènes publiques seulement. Avec un lecteur, tout ce que
 * son agenda lui montre : les publiques, et les privées qui lui sont ouvertes
 * — la même règle que l'agenda du site (`accessFilter`), administration
 * comprise, qui n'y a pas de passe-droit.
 *
 * Partagé entre `/api/evenements/aujourdhui`, public et resservi par le CDN,
 * et `/api/evenements/aujourdhui/pour-moi`, qui demande une session : une
 * seule définition du « jour ».
 */
export async function scenesDuJour(viewer: SessionUser | null, limite: number) {
  const maintenant = new Date();
  const civil = gameCivil(maintenant);
  // `Date.UTC` reporte le trente-deuxième jour sur le mois suivant.
  const minuit = fromGameCivil(civil.year, civil.month, civil.day + 1, 0);

  // `to` borne le début côté base sans retirer `pasEncoreFini`, qui ne cède
  // qu'à `from` ; il est inclusif, donc le filtre strict écarte une scène
  // posée à minuit pile, qui est du lendemain.
  const scenes = (
    await listEvents(
      viewer ? { viewer, to: minuit } : { viewer: null, access: "publiques", to: minuit },
    )
  ).filter((evenement) => new Date(evenement.startsAt) < minuit);

  const jour = `${civil.year}-${String(civil.month).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`;

  return {
    corps: { jour, total: scenes.length, evenements: scenes.slice(0, limite).map(formeEvenement) },
    /** Les secondes qui restent avant minuit : au-delà, la réponse annoncerait la veille. */
    jusquaMinuit: Math.max(Math.floor((minuit.getTime() - maintenant.getTime()) / 1000), 1),
  };
}
