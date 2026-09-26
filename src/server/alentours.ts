import "server-only";

import type { Region } from "@/lib/domain";
import { zoneAt } from "@/lib/weather/grid";
import { formeEvenement, formeRumeur, type Point } from "@/server/api-overlay";
import { listEvents } from "@/server/queries/events";
import { listPlacesForMap } from "@/server/queries/places";
import { listRumors } from "@/server/queries/rumors";
import { listTerrainZones } from "@/server/queries/weather";

/**
 * Ce qu'il y a autour d'un point de la carte, pour l'application bureau.
 *
 * Quatre calculs, partagés entre `/api/alentours` — qui les rend ensemble — et
 * les routes `/api/lieux/proximite`, `/api/evenements/proximite` et
 * `/api/rumeurs?x&y`, qui les rendent séparément pour les versions déjà
 * installées : une seule définition de « à proximité », sinon les deux
 * chemins finiraient par dire deux choses.
 *
 * Tout est public, lu sans lecteur : rien de privé n'en sort.
 */

/**
 * Les lieux du registre à moins de `rayon` du point, du plus proche au plus
 * éloigné. La distance est celle du plan, en pixels de continent, entre le
 * point et le pin du lieu. Un lieu sans coordonnées n'a pas de distance : il
 * n'est pas proche, il n'est nulle part sur la carte, et il ne figure pas ici.
 *
 * La forme est écrite champ par champ, pas recopiée de `PlaceSummary` : de quoi
 * nommer un lieu, le situer et dire s'il s'y passe quelque chose. La bannière,
 * le résumé et l'auteur restent sur la fiche.
 */
export async function lieuxAutour(point: Point, rayon: number, limite: number) {
  return (await listPlacesForMap())
    .flatMap((lieu) => {
      if (!lieu.coordinates) return [];
      const distance = Math.hypot(lieu.coordinates.x - point.x, lieu.coordinates.y - point.y);
      if (distance > rayon) return [];
      return [
        {
          id: lieu.id,
          slug: lieu.slug,
          name: lieu.name,
          type: lieu.type,
          region: lieu.region,
          district: lieu.district,
          coordinates: lieu.coordinates,
          upcomingEventCount: lieu.upcomingEventCount,
          distance: Math.round(distance),
        },
      ];
    })
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "fr"))
    .slice(0, limite);
}

/**
 * Les scènes publiques qui ne sont pas finies à moins de `rayon` du point, de
 * la plus proche à la plus éloignée. Une scène hérite du point de son lieu ;
 * une scène sans point n'est nulle part sur la carte et ne figure pas ici.
 * L'agenda public entier tient en une lecture — quelques dizaines de scènes —,
 * donc le tri se fait en mémoire, sur le résultat de la même requête que
 * l'agenda.
 */
export async function scenesAutour(point: Point, rayon: number, limite: number) {
  return (await listEvents({ viewer: null, access: "publiques" }))
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
}

/** La région d'un point, par la **même règle que la météo** : la zone de
 *  terrain qui le couvre, la dernière de la liste l'emportant. `null` hors de
 *  toute région. */
export async function regionDe(point: Point): Promise<Region | null> {
  return zoneAt(point.x, point.y, await listTerrainZones())?.region ?? null;
}

/** Les dernières rumeurs d'une région, les plus récentes d'abord, sans l'état
 *  du lecteur. `undefined` vaut toute la Tyrie ; `null` — hors région — n'en a
 *  aucune, plutôt que de montrer la Tyrie entière. */
export async function rumeursDe(region: Region | null | undefined, limite: number) {
  if (region === null) return [];
  const { items } = await listRumors({ region: region ?? undefined, pageSize: limite });
  return items.map(formeRumeur);
}
