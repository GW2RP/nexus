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

/** On ne signale jamais son propre contenu : l'auteur voit « Modifier » à la place. */
export function canReportContent(user: SessionUser | null, authorId: string): boolean {
  return canContribute(user) && user.id !== authorId;
}
