import { NextResponse } from "next/server";

import { REGIONS, type Region } from "@/lib/domain";
import { regionDe, rumeursDe } from "@/server/alentours";
import { DUREE_ALENTOURS, lireLimite, lirePoint, reponsePublique } from "@/server/api-overlay";

export const dynamic = "force-dynamic";

const LIMITE_PAR_DEFAUT = 5;
const LIMITE_MAXIMALE = 25;

/**
 * Les dernières rumeurs d'une région, pour l'application bureau. Le tableau
 * des rumeurs est public ; ceci en est un extrait, les plus récentes d'abord,
 * sans l'état du lecteur.
 *
 * La région se nomme (`?region=kryte`) ou se déduit d'un point de la carte
 * (`?x=…&y=…`) par la **même règle que la météo** : la zone de terrain qui
 * couvre le point, la dernière de la liste l'emportant. Un point hors de toute
 * région n'a pas de rumeurs à lui, et la réponse le dit (`region: null`)
 * plutôt que de montrer la Tyrie entière.
 *
 * Une région inconnue — ou nommée vide, `?region=` — vaut une erreur, pas
 * « toutes » : une faute de frappe qui ferait taire le filtre en silence
 * montrerait tout à qui croyait lire la Kryte. Sans région ni point, erreur
 * aussi : « toute la Tyrie » sous `region: null` se lirait comme « hors
 * région », et une réponse que le CDN ressert ne doit pas être ambiguë.
 *
 * Depuis `/api/alentours`, l'application bureau lit les rumeurs avec les lieux
 * et les scènes en un appel ; cette route reste pour les versions installées.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  let region: Region | null;
  const nommee = searchParams.get("region")?.trim();
  const point = lirePoint(searchParams);

  if (nommee !== undefined) {
    region = REGIONS.find((candidate) => candidate === nommee) ?? null;
    if (region === null) {
      return NextResponse.json({ erreur: "Région inconnue." }, { status: 400 });
    }
  } else if (point) {
    region = await regionDe(point);
  } else {
    return NextResponse.json({ erreur: "Région ou coordonnées requises." }, { status: 400 });
  }

  const rumeurs = await rumeursDe(region, limite);
  return reponsePublique({ region, rumeurs }, DUREE_ALENTOURS);
}
