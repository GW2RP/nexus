import "server-only";

import { NextResponse } from "next/server";

import { clampX, clampY } from "@/lib/map";
import type {
  CharacterSummary,
  EventSummary,
  GroupSummary,
  PlaceDetail,
  PlaceSummary,
  RumorSummary,
} from "@/server/types";

/**
 * Ce que le hub écrit pour l'application bureau, et dans quelle forme.
 *
 * Les routes `/api/*` que l'overlay lit sont publiques, comme le relevé de
 * météo : elles ne montrent rien que le site ne montre déjà à un visiteur sans
 * compte. Leurs réponses s'écrivent **champ par champ**, jamais en recopiant
 * une forme interne : un champ ajouté au registre demain ne sortira pas ici
 * sans qu'on l'ait décidé, et une bannière ou un auteur ne voyagent pas là où
 * personne ne les lit.
 */

/** Un nombre lu dans l'adresse, ou `null`. `Number(null)` et `Number("")`
 *  valent zéro : sans ce garde-fou, une requête sans coordonnées sonderait
 *  le coin nord-ouest du continent en silence. */
export function lireNombre(searchParams: URLSearchParams, nom: string): number | null {
  const brut = searchParams.get(nom);
  if (brut === null || brut.trim() === "") return null;
  const valeur = Number(brut);
  return Number.isFinite(valeur) ? valeur : null;
}

/** Une limite de liste, bornée : au-delà, ce n'est plus un extrait. Le
 *  paramètre s'appelle `limite`, sauf quand une route en porte deux. */
export function lireLimite(
  searchParams: URLSearchParams,
  parDefaut: number,
  maximale: number,
  nom = "limite",
): number {
  return Math.min(Math.max(Math.round(lireNombre(searchParams, nom) ?? parDefaut), 1), maximale);
}

/** Le rayon de recherche par défaut, en pixels de continent. Une carte du jeu
 *  fait trois à quatre mille pixels de large : ce rayon couvre la carte où l'on
 *  se tient et déborde un peu sur les voisines. */
export const RAYON_PAR_DEFAUT = 2_500;
/** Au-delà, la liste dirait « tout le continent » — ce n'est plus la proximité. */
export const RAYON_MAXIMAL = 10_000;
export const LIMITE_PAR_DEFAUT = 8;
export const LIMITE_MAXIMALE = 25;

export type Point = { x: number; y: number };

/** Le point d'une adresse, arrondi et borné au continent plutôt que refusé :
 *  un personnage au bord d'une carte tombe parfois d'un pixel dehors, et ce
 *  n'est pas une erreur. `null` quand une coordonnée manque ou ne se lit pas. */
export function lirePoint(searchParams: URLSearchParams): Point | null {
  const x = lireNombre(searchParams, "x");
  const y = lireNombre(searchParams, "y");
  if (x === null || y === null) return null;
  return { x: clampX(Math.round(x)), y: clampY(Math.round(y)) };
}

export function lireRayon(searchParams: URLSearchParams): number {
  return Math.min(Math.max(lireNombre(searchParams, "rayon") ?? RAYON_PAR_DEFAUT, 1), RAYON_MAXIMAL);
}

/** Combien de temps le CDN peut resservir les alentours d'un point. Ils
 *  changent à chaque scène annoncée ou rumeur postée, et aucune étiquette ne
 *  purge le CDN — seul le temps le fait : deux minutes de retard, au plus, pour
 *  qui les lit depuis le jeu. */
export const DUREE_ALENTOURS = 120;

/** Une réponse publique que le CDN de Vercel peut resservir sans rappeler la
 *  fonction. `s-maxage` ne s'adresse qu'aux caches partagés ; le navigateur et
 *  l'application relisent normalement. Passé le délai, l'ancienne réponse est
 *  encore servie une minute pendant que la suivante se calcule. Une erreur n'y
 *  passe jamais : elle ne mérite pas d'être resservie. L'application bureau
 *  arrondit les points qu'elle demande pour que les adresses se répètent d'un
 *  joueur à l'autre ; sans cela, l'en-tête ne servirait à rien. */
export function reponsePublique(corps: unknown, secondes: number): NextResponse {
  return NextResponse.json(corps, {
    headers: { "Cache-Control": `public, s-maxage=${secondes}, stale-while-revalidate=60` },
  });
}

/** Un lieu tel que le registre le résume : de quoi le nommer, le situer et
 *  dire s'il s'y passe quelque chose. */
export function formeLieuResume(lieu: PlaceSummary) {
  return {
    id: lieu.id,
    slug: lieu.slug,
    name: lieu.name,
    type: lieu.type,
    region: lieu.region,
    district: lieu.district,
    summary: lieu.summary,
    bannerUrl: lieu.bannerUrl,
    bannerAlt: lieu.bannerAlt,
    coordinates: lieu.coordinates,
    upcomingEventCount: lieu.upcomingEventCount,
    activity: lieu.activity,
  };
}

/** La fiche entière : le résumé, et ce qu'on lit une fois dedans. Les comptes
 *  qui la tiennent restent sur le site — l'overlay n'a rien à en faire. */
export function formeLieu(lieu: PlaceDetail) {
  return {
    ...formeLieuResume(lieu),
    description: lieu.description,
    access: lieu.access,
    floorPlans: lieu.floorPlans,
    keepers: lieu.keepers,
    updatedAt: lieu.updatedAt,
  };
}

/** Une scène, sans l'état du lecteur : l'overlay n'en a pas, et une lecture
 *  publique ne porte pas d'inscription. */
export function formeEvenement(evenement: EventSummary) {
  return {
    id: evenement.id,
    slug: evenement.slug,
    title: evenement.title,
    type: evenement.type,
    summary: evenement.summary,
    startsAt: evenement.startsAt,
    endsAt: evenement.endsAt,
    region: evenement.region,
    locationLabel: evenement.locationLabel,
    place: evenement.place,
    coordinates: evenement.coordinates,
    capacity: evenement.capacity,
    registeredCount: evenement.registeredCount,
    liveStatus: evenement.liveStatus,
    // Toujours « publique » sur les routes sans lecteur ; « privee » ne sort
    // que de `pour-moi`, pour que l'overlay dise qu'il faut être connecté sur
    // le site pour l'ouvrir.
    visibility: evenement.visibility,
  };
}

export function formeRumeur(rumeur: RumorSummary) {
  return {
    id: rumeur.id,
    body: rumeur.body,
    character: rumeur.character,
    place: rumeur.place,
    heardAtLabel: rumeur.heardAtLabel,
    region: rumeur.region,
    echoCount: rumeur.echoCount,
    createdAt: rumeur.createdAt,
  };
}

export function formePersonnage(personnage: CharacterSummary) {
  return {
    id: personnage.id,
    slug: personnage.slug,
    name: personnage.name,
    race: personnage.race,
    gender: personnage.gender,
    title: personnage.title,
    homePlaceLabel: personnage.homePlaceLabel,
    portraitUrl: personnage.portraitUrl,
    portraitAlt: personnage.portraitAlt,
  };
}

export function formeGroupe(groupe: GroupSummary) {
  return {
    id: groupe.id,
    slug: groupe.slug,
    name: groupe.name,
    summary: groupe.summary,
    memberCount: groupe.memberCount,
    upcomingEventCount: groupe.upcomingEventCount,
  };
}
