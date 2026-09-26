import "server-only";

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

/** Une limite de liste, bornée : au-delà, ce n'est plus un extrait. */
export function lireLimite(
  searchParams: URLSearchParams,
  parDefaut: number,
  maximale: number,
): number {
  return Math.min(Math.max(Math.round(lireNombre(searchParams, "limite") ?? parDefaut), 1), maximale);
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
