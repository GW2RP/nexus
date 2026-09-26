import { NextResponse } from "next/server";

import { stepEnd } from "@/lib/weather/schedule";
import { lirePoint, reponsePublique } from "@/server/api-overlay";
import { getWeatherProbe } from "@/server/queries/weather";

export const dynamic = "force-dynamic";

/** La marge du cron : `/api/meteo/avancer` passe à la cinquième minute de
 *  l'heure, et le pas suivant n'existe pas en base avant. Une minute de plus
 *  pour qu'il s'exécute. */
const DECALAGE_CRON_MS = 6 * 60 * 1000;
/** Passé la fin du pas sans avancement, le cron a pu manquer : on ne resserre
 *  qu'une minute, et on ne s'y fie pas plus. */
const DUREE_MINIMALE = 60;
/** Le rythme auquel l'application bureau relit de toute façon. */
const DUREE_MAXIMALE = 300;

/**
 * Le temps en un point de la carte.
 *
 * Une lecture, publique comme la météo elle-même : pas de secret, pas de rôle.
 * Elle existe parce que la grille entière ne peut pas voyager jusqu'au
 * navigateur — 143 360 cellules et dix grandeurs — alors qu'un relevé tient en
 * quelques nombres.
 *
 * Les coordonnées sont bornées au continent plutôt que refusées : un clic au
 * bord de la carte tombe parfois d'un pixel dehors, et ce n'est pas une erreur.
 *
 * La réponse porte un `Cache-Control` que le CDN honore, borné à la fin du pas
 * servi — plus la minute pendant laquelle l'ancienne réponse est encore servie
 * le temps que la suivante se calcule : l'application bureau demande le centre
 * de la cellule, donc deux personnages sous le même ciel reçoivent le même
 * relevé sans que le hub le recalcule.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const point = lirePoint(searchParams);
  if (!point) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }

  const releve = await getWeatherProbe(point.x, point.y);
  if (!releve) {
    return NextResponse.json({ erreur: "Aucun pas de simulation en base." }, { status: 404 });
  }

  return reponsePublique(releve, dureeDeValidite(releve.stepIndex));
}

/** Combien de temps le CDN peut resservir ce relevé : jusqu'à ce que le pas
 *  suivant ait pu être écrit, et jamais plus de cinq minutes. Sans cela, un
 *  relevé mis en cache à 13 h 59 masquerait le pas de 14 h. */
function dureeDeValidite(stepIndex: number): number {
  const restant = Math.floor(
    (stepEnd(stepIndex).getTime() + DECALAGE_CRON_MS - Date.now()) / 1000,
  );
  return Math.min(Math.max(restant, DUREE_MINIMALE), DUREE_MAXIMALE);
}
