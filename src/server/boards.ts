import "server-only";

import type { BoardVisibility } from "@/lib/boards";
import type { BoardAccess } from "@/lib/permissions";
import { Board, type BoardDocument } from "@/models/board";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { groupBoardPath, placeBoardPath } from "@/server/queries/boards";
import { connectToDatabase, toObjectId } from "@/server/queries/shared";

/** Ce que les actions des panneaux partagent — et que la modération réutilise.
 *  Ce module n'est pas une action serveur : rien de ce qu'il exporte ne doit
 *  pouvoir s'appeler depuis le navigateur. */

export type BoardDoc = BoardDocument & { _id: unknown; updatedAt?: Date };
export type RawElement = BoardDoc["elements"][number] & { _id: unknown };
export type RawArrow = BoardDoc["arrows"][number] & { _id: unknown };

export type LoadedBoard = {
  doc: BoardDoc;
  access: BoardAccess;
  /** L'adresse du panneau. */
  path: string;
  /** La fiche qui le porte : celle du groupe, ou celle du lieu. */
  ownerPath: string;
};

/** Un panneau et ce qui décide de ses droits : son groupe ou son lieu, relus à
 *  chaque écriture. Une appartenance retirée doit l'être au geste suivant. */
export async function loadBoard(boardId: string | null): Promise<LoadedBoard | null> {
  await connectToDatabase();
  const id = boardId ? toObjectId(boardId) : null;
  if (!id) return null;
  const doc = (await Board.findOne({ _id: id, hidden: { $ne: true } } as never).lean()) as BoardDoc | null;
  if (!doc) return null;

  if (doc.ownerType === "lieu") {
    const place = await Place.findOne({ _id: doc.placeId, hidden: { $ne: true } } as never)
      .select({ slug: 1, authorId: 1, managerIds: 1 })
      .lean();
    if (!place) return null;
    return {
      doc,
      access: {
        ownerType: "lieu",
        place: { authorId: place.authorId, managerIds: place.managerIds ?? [] },
      },
      path: placeBoardPath(place.slug),
      ownerPath: `/lieux/${place.slug}`,
    };
  }

  const group = await Group.findOne({ _id: doc.groupId, hidden: { $ne: true } } as never)
    .select({ slug: 1, authorId: 1, memberIds: 1, visibility: 1 })
    .lean();
  if (!group) return null;
  return {
    doc,
    access: {
      ownerType: "groupe",
      visibility: doc.visibility as BoardVisibility,
      group: {
        visibility: group.visibility,
        authorId: group.authorId,
        memberIds: group.memberIds ?? [],
      },
    },
    path: groupBoardPath(group.slug, String(doc._id)),
    ownerPath: `/groupes/${group.slug}`,
  };
}

/** Le panneau qui porte un élément, pour un signalement ou sa décision. */
export async function loadBoardOfElement(
  elementId: string,
): Promise<(LoadedBoard & { element: RawElement }) | null> {
  await connectToDatabase();
  const id = toObjectId(elementId);
  if (!id) return null;
  const doc = await Board.findOne({ "elements._id": id } as never)
    .select({ _id: 1 })
    .lean();
  if (!doc) return null;
  const loaded = await loadBoard(String(doc._id));
  const element = (loaded?.doc.elements as RawElement[] | undefined)?.find(
    (one) => String(one._id) === elementId,
  );
  if (!loaded || !element) return null;
  return { ...loaded, element };
}

/** Retirer un élément pour de bon, avec les flèches qui s'y rattachent. C'est
 *  la suppression de la modération : rien ne part à la corbeille, rien ne se
 *  rétablit. */
export async function deleteBoardElement(elementId: string): Promise<void> {
  const id = toObjectId(elementId);
  if (!id) return;
  await Board.updateOne(
    { "elements._id": id } as never,
    { $pull: { elements: { _id: id }, arrows: { $or: [{ from: id }, { to: id }] } } } as never,
  );
}

/** Masquer ou démasquer un élément. Masqué, il ne s'affiche plus nulle part ;
 *  ses flèches disparaissent avec lui, sans être retirées. */
export async function setBoardElementHidden(elementId: string, hidden: boolean): Promise<void> {
  const id = toObjectId(elementId);
  if (!id) return;
  await Board.updateOne(
    { "elements._id": id } as never,
    { $set: { "elements.$[e].hidden": hidden } } as never,
    { arrayFilters: [{ "e._id": id }] },
  );
}
