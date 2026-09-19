import type { Role } from "@/lib/domain";
import type { SessionUser } from "@/lib/session";

/** Les droits du hub.
 *
 *  | Rôle           | Peut                                                              |
 *  | -------------- | ----------------------------------------------------------------- |
 *  | Visiteur       | Lire le contenu public.                                           |
 *  | Membre         | Créer et modifier son contenu, s'inscrire, signaler.              |
 *  | Conteur        | En plus : poser la météo d'une région, épingler un évènement.      |
 *  | Administration | En plus : la file des signalements, suppression, avertissement.    |
 */

const RANK: Record<Role, number> = { membre: 1, conteur: 2, administration: 3 };

export function isSuspended(user: SessionUser | null): boolean {
  if (!user?.suspendedUntil) return false;
  return user.suspendedUntil.getTime() > Date.now();
}

/** Un compte suspendu lit le hub mais n'y écrit plus. */
export function canContribute(user: SessionUser | null): user is SessionUser {
  return user !== null && !isSuspended(user);
}

export function hasRole(user: SessionUser | null, role: Role): boolean {
  if (!user) return false;
  return RANK[user.role] >= RANK[role];
}

export function isStoryteller(user: SessionUser | null): boolean {
  return hasRole(user, "conteur");
}

export function isAdmin(user: SessionUser | null): boolean {
  return hasRole(user, "administration");
}

/** L'auteur d'un contenu, ou l'administration, peut le modifier et le supprimer. */
export function canEditContent(user: SessionUser | null, authorId: string): boolean {
  if (!canContribute(user)) return false;
  return user.id === authorId || isAdmin(user);
}

/** L'auteur d'un contenu, et lui seul. L'administration modifie tout, mais la
 *  fiche n'est pas la sienne pour autant : c'est ce qui distingue « modifier ma
 *  fiche » de « modifier la fiche ». */
export function isContentAuthor(user: SessionUser | null, authorId: string): boolean {
  return user !== null && user.id === authorId;
}

/** Un lieu se tient à plusieurs : ses co-gérants le modifient comme son auteur.
 *  La liste des co-gérants, elle, reste à l'auteur — voir `canManagePlaceTeam`. */
export function canEditPlace(
  user: SessionUser | null,
  place: { authorId: string; managerIds: string[] },
): boolean {
  if (!canContribute(user)) return false;
  return canEditContent(user, place.authorId) || place.managerIds.includes(user.id);
}

/** Qui nomme et révoque les co-gérants : l'auteur du lieu, ou l'administration.
 *  Un co-gérant qui pourrait s'en adjoindre d'autres rendrait la liste
 *  incontrôlable pour celui qui a posé le lieu. */
export function canManagePlaceTeam(
  user: SessionUser | null,
  place: { authorId: string },
): boolean {
  return canEditContent(user, place.authorId);
}

/** On ne signale jamais son propre contenu : l'auteur voit « Modifier » à la place. */
export function canReportContent(user: SessionUser | null, authorId: string): boolean {
  return canContribute(user) && user.id !== authorId;
}
