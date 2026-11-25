import "server-only";

import type { BoardContent } from "@/lib/boards";
import { canSeeBoard } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Board } from "@/models/board";
import { loadBoard } from "@/server/boards";
import { serializeContent } from "@/server/queries/boards";
import { connectToDatabase, toObjectId } from "@/server/queries/shared";

/** Le suivi d'un panneau ouvert. L'éditeur redemande toutes les deux
 *  secondes où en est le panneau ; tant que la révision n'a pas bougé, la
 *  réponse ne porte que ce numéro, lu sans descendre les éléments. */

export type BoardPull = {
  revision: number;
  /** Le contenu tel que ce lecteur le voit, seulement quand la révision a
   *  changé depuis `depuis`. */
  content: BoardContent | null;
};

/** `grantedRead` : la lecture est déjà accordée par ailleurs — le panneau
 *  qu'une activité Discord montre à tous ses participants. Les droits
 *  d'écriture, eux, ne changent pas. */
export async function pullBoard(
  boardId: string,
  depuis: number | null,
  viewer: SessionUser | null,
  grantedRead = false,
): Promise<BoardPull | null> {
  await connectToDatabase();
  const id = toObjectId(boardId);
  if (!id) return null;
  const head = (await Board.findOne({ _id: id, hidden: { $ne: true } } as never)
    .select({ revision: 1 })
    .lean()) as { revision?: number } | null;
  if (!head) return null;
  const revision = head.revision ?? 0;
  // Rien n'a bougé : on ne dit que le numéro, que seul connaît qui a déjà lu
  // le panneau.
  if (depuis !== null && depuis === revision) return { revision, content: null };

  const loaded = await loadBoard(boardId);
  if (!loaded) return null;
  if (!grantedRead && !canSeeBoard(viewer, loaded.access)) return null;
  return {
    revision: loaded.doc.revision ?? 0,
    content: await serializeContent(loaded.doc, viewer),
  };
}
