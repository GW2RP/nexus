import type { EventVisibility, GroupVisibility, Role } from "@/lib/domain";
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

/** Ce qu'il faut savoir d'une scène pour décider si quelqu'un la voit. */
export type EventAccess = {
  visibility: EventVisibility;
  authorId: string;
  invitedUserIds: string[];
  groupId: string | null;
};

/** Ce que le lecteur apporte : ses groupes, son inscription, et le code qu'il
 *  a présenté dans l'adresse. */
export type ViewerAccess = {
  groupIds?: string[];
  registered?: boolean;
  /** Le lien de partage a été suivi et son code correspond. */
  withShareCode?: boolean;
};

/** Qui voit une scène.
 *
 *  Une scène publique se lit sans compte. Une scène privée se lit par cinq
 *  chemins, et cinq seulement : on l'organise, on y est invité nommément, on
 *  est du groupe qui lui est associé, on y est déjà inscrit, ou on présente
 *  son code de partage. L'administration voit tout : un contenu signalé doit
 *  pouvoir être lu par ceux qui le modèrent.
 *
 *  Le code suffit sans compte : « qui a le lien peut consulter ». Rejoindre,
 *  en revanche, demande un compte — c'est `canContribute` qui le dit. */
export function canSeeEvent(
  user: SessionUser | null,
  event: EventAccess,
  viewer: ViewerAccess = {},
): boolean {
  if (event.visibility === "publique") return true;
  if (viewer.withShareCode) return true;
  if (!user) return false;
  if (user.id === event.authorId || isAdmin(user)) return true;
  if (event.invitedUserIds.includes(user.id)) return true;
  if (viewer.registered) return true;
  return Boolean(event.groupId && viewer.groupIds?.includes(event.groupId));
}

/** Qui peut inviter à une scène, changer son code et lui associer un groupe :
 *  celui qui l'organise. Un invité n'invite pas à son tour — sinon la liste
 *  échapperait à celui qui a posé la scène, comme pour les co-gérants d'un lieu. */
export function canManageEventGuests(user: SessionUser | null, authorId: string): boolean {
  return canEditContent(user, authorId);
}

export type GroupAccess = {
  visibility: GroupVisibility;
  authorId: string;
  memberIds: string[];
};

/** Un membre du groupe : ses membres, et le meneur, qui en est de droit. */
export function isGroupMember(user: SessionUser | null, group: GroupAccess): boolean {
  if (!user) return false;
  return user.id === group.authorId || group.memberIds.includes(user.id);
}

/** Qui voit un groupe. « Public » dit qui le voit, pas qui peut y entrer :
 *  dans les deux cas, c'est le meneur qui ajoute les membres. */
export function canSeeGroup(user: SessionUser | null, group: GroupAccess): boolean {
  if (group.visibility === "public") return true;
  if (!user) return false;
  return isAdmin(user) || isGroupMember(user, group);
}

/** Qui mène le groupe : celui qui l'a fondé, ou l'administration. Un membre
 *  n'en adjoint pas d'autres. */
export function canManageGroup(user: SessionUser | null, group: { authorId: string }): boolean {
  return canEditContent(user, group.authorId);
}
