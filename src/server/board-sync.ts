import "server-only";

import type { BoardContent } from "@/lib/boards";
import { canSeeBoard } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { loadBoard, loadBoardAccess } from "@/server/boards";
import { activityGrantsBoard, type ActivityReadGrant } from "@/server/discord/activity";
import { serializeContent } from "@/server/queries/boards";

/** Le suivi d'un panneau ouvert. L'éditeur redemande toutes les deux
 *  secondes où en est le panneau ; tant que la révision n'a pas bougé, la
 *  réponse ne porte que ce numéro, lu sans descendre les éléments. */

export type BoardPull = {
  revision: number;
  /** Le contenu tel que ce lecteur le voit, seulement quand la révision a
   *  changé depuis `depuis`. */
  content: BoardContent | null;
};

/** `grant` : ce qu'ouvre le laissez-passer d'une activité Discord — le
 *  panneau que l'instance montre à tous ses participants. Les droits
 *  d'écriture, eux, ne changent pas.
 *
 *  Les droits se jouent **avant** la réponse « rien n'a bougé » : sans quoi
 *  elle dirait à qui ne lit pas le panneau qu'il existe et à quel rythme on y
 *  écrit, et un éditeur dont l'accès a été retiré ne s'en apercevrait pas. */
export async function pullBoard(
  boardId: string,
  depuis: number | null,
  viewer: SessionUser | null,
  grant: ActivityReadGrant | null = null,
): Promise<BoardPull | null> {
  const head = await loadBoardAccess(boardId);
  if (!head) return null;
  if (!canSeeBoard(viewer, head.access) && !activityGrantsBoard(grant, boardId, head.access)) return null;
  if (depuis !== null && depuis === head.revision) return { revision: head.revision, content: null };

  const loaded = await loadBoard(boardId);
  if (!loaded) return null;
  return {
    revision: loaded.doc.revision ?? 0,
    content: await serializeContent(loaded.doc, viewer),
  };
}
