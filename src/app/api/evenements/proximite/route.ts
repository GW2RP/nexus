import { NextResponse } from "next/server";

import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import { formeEvenement, lireLimite, lireNombre } from "@/server/api-overlay";
import { listEvents } from "@/server/queries/events";

export const dynamic = "force-dynamic";

/** Le même rayon par défaut que pour les lieux : la carte où l'on se tient, et
 *  un peu des voisines. */
const RAYON_PAR_DEFAUT = 2_500;
const RAYON_MAXIMAL = 10_000;
const LIMITE_PAR_DEFAUT = 8;
const LIMITE_MAXIMALE = 25;

/**
 * Les scènes publiques qui ne sont pas finies autour d'un point de la carte,
 * de la plus proche à la plus éloignée, pour l'application bureau.
 *
 * Une scène hérite du point de son lieu ; une scène sans point n'est nulle
 * part sur la carte et ne figure pas ici. L'agenda public entier tient en une
 * lecture — quelques dizaines de scènes —, donc le tri se fait en mémoire, sur
 * le résultat de la même requête que l'agenda.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const x = lireNombre(searchParams, "x");
  const y = lireNombre(searchParams, "y");
  if (x === null || y === null) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }

  const point = {
    x: Math.min(Math.max(Math.round(x), 0), CONTINENT_WIDTH - 1),
    y: Math.min(Math.max(Math.round(y), 0), CONTINENT_HEIGHT - 1),
  };
  const rayon = Math.min(Math.max(lireNombre(searchParams, "rayon") ?? RAYON_PAR_DEFAUT, 1), RAYON_MAXIMAL);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  const evenements = (await listEvents({ viewer: null, access: "publiques" }))
    .flatMap((evenement) => {
      if (!evenement.coordinates) return [];
      const distance = Math.hypot(
        evenement.coordinates.x - point.x,
        evenement.coordinates.y - point.y,
      );
      if (distance > rayon) return [];
      return [{ ...formeEvenement(evenement), distance: Math.round(distance) }];
    })
    // À égale distance — deux scènes au même lieu —, la plus proche dans le temps
    // d'abord : c'est celle qu'on cherche en arrivant.
    .sort((a, b) => a.distance - b.distance || a.startsAt.localeCompare(b.startsAt))
    .slice(0, limite);

  return NextResponse.json({ ...point, rayon, evenements });
}
