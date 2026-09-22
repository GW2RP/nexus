import "server-only";

import {
  ARROW_DASHES,
  ARROW_HEADS,
  ARROW_WIDTHS,
  type ArrowDash,
  type ArrowHeads,
  type ArrowWidth,
  type BoardContent,
  type BoardOwner,
  type BoardVisibility,
  type ElementKind,
} from "@/lib/boards";
import { canSeeBoard, type BoardAccess, type GroupAccess } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Board, type BoardDocument } from "@/models/board";
import { connectToDatabase, loadAuthors, toIso, toObjectId } from "@/server/queries/shared";
import type { BoardSummary } from "@/server/types";

/** Les panneaux ne passent pas par `remember`. Chaque déplacement d'une note est
 *  une écriture : une étiquette retirée à chaque geste ne servirait jamais son
 *  entrée. Et ce qu'on y lit dépend de qui le lit — un panneau réservé aux
 *  membres n'existe pas pour les autres —, comme la fiche d'un groupe. */

type BoardDoc = BoardDocument & { _id: unknown; createdAt?: Date; updatedAt?: Date };
type RawElement = BoardDoc["elements"][number] & { _id: unknown; createdAt?: Date };
type RawArrow = BoardDoc["arrows"][number] & { _id: unknown; createdAt?: Date };

function pick<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback;
}

/** Le contenu lisible d'un panneau : les éléments que la modération n'a pas
 *  masqués, et les flèches dont les deux bouts sont encore là. */
export async function serializeContent(doc: Pick<BoardDoc, "elements" | "arrows">): Promise<BoardContent> {
  const elements = ((doc.elements ?? []) as RawElement[]).filter((element) => !element.hidden);
  const visible = new Set(elements.map((element) => String(element._id)));
  const arrows = ((doc.arrows ?? []) as RawArrow[]).filter(
    (arrow) => visible.has(String(arrow.from)) && visible.has(String(arrow.to)),
  );
  const authors = await loadAuthors([
    ...elements.map((element) => element.authorId),
    ...arrows.map((arrow) => arrow.authorId),
  ]);

  return {
    elements: elements
      .map((element) => ({
        id: String(element._id),
        kind: element.kind as ElementKind,
        x: element.x,
        y: element.y,
        w: element.w,
        h: element.h,
        z: element.z ?? 0,
        text: element.text ?? "",
        size: element.size,
        stroke: element.stroke,
        fill: element.fill,
        ink: element.ink,
        authorId: element.authorId,
        authorName: authors.get(element.authorId)?.name ?? null,
        createdAt: toIso(element.createdAt ?? new Date(0)),
      }))
      .sort((a, b) => a.z - b.z),
    arrows: arrows.map((arrow) => ({
      id: String(arrow._id),
      from: String(arrow.from),
      to: String(arrow.to),
      color: arrow.color,
      heads: pick<ArrowHeads>(ARROW_HEADS, arrow.heads, "fin"),
      dash: pick<ArrowDash>(ARROW_DASHES, arrow.dash, "plein"),
      width: pick<ArrowWidth>(ARROW_WIDTHS, arrow.width, "fin"),
      label: arrow.label ?? "",
      authorId: arrow.authorId,
      authorName: authors.get(arrow.authorId)?.name ?? null,
      createdAt: toIso(arrow.createdAt ?? new Date(0)),
    })),
  };
}

async function toSummary(doc: BoardDoc, path: string): Promise<BoardSummary> {
  const content = await serializeContent(doc);
  return {
    ...content,
    id: String(doc._id),
    name: doc.name,
    ownerType: doc.ownerType as BoardOwner,
    visibility: doc.visibility as BoardVisibility,
    path,
    elementCount: content.elements.length,
    authorId: doc.authorId,
    createdAt: toIso(doc.createdAt ?? new Date(0)),
    updatedAt: toIso(doc.updatedAt ?? new Date(0)),
  };
}

export function groupBoardPath(groupSlug: string, boardId: string): string {
  return `/groupes/${groupSlug}/panneaux/${boardId}`;
}

export function placeBoardPath(placeSlug: string): string {
  return `/lieux/${placeSlug}/panneau`;
}

/** Les panneaux d'un groupe que le lecteur peut voir, dans l'ordre où ils ont
 *  été ouverts. Le groupe a déjà été lu — et son accès vérifié — par la page. */
export async function listGroupBoards(
  group: GroupAccess & { id: string; slug: string },
  viewer: SessionUser | null,
): Promise<BoardSummary[]> {
  await connectToDatabase();
  const groupId = toObjectId(group.id);
  if (!groupId) return [];
  const docs = (await Board.find({ groupId, hidden: { $ne: true } } as never)
    .select({ removed: 0, removedArrows: 0 })
    .sort({ createdAt: 1 })
    .lean()) as BoardDoc[];

  const visible = docs.filter((doc) =>
    canSeeBoard(viewer, {
      ownerType: "groupe",
      visibility: doc.visibility as BoardVisibility,
      group,
    }),
  );
  return Promise.all(
    visible.map((doc) => toSummary(doc, groupBoardPath(group.slug, String(doc._id)))),
  );
}

/** Les noms des panneaux d'un groupe, sans leur contenu : les onglets d'un
 *  panneau n'ont pas à charger ceux des autres. */
export async function listGroupBoardTabs(
  group: GroupAccess & { id: string; slug: string },
  viewer: SessionUser | null,
): Promise<{ id: string; name: string; path: string }[]> {
  await connectToDatabase();
  const groupId = toObjectId(group.id);
  if (!groupId) return [];
  const docs = (await Board.find({ groupId, hidden: { $ne: true } } as never)
    .select({ name: 1, visibility: 1 })
    .sort({ createdAt: 1 })
    .lean()) as Pick<BoardDoc, "_id" | "name" | "visibility">[];
  return docs
    .filter((doc) =>
      canSeeBoard(viewer, { ownerType: "groupe", visibility: doc.visibility as BoardVisibility, group }),
    )
    .map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      path: groupBoardPath(group.slug, String(doc._id)),
    }));
}

/** Un panneau de groupe par son identifiant, ou `null` quand le lecteur n'a pas
 *  à savoir qu'il existe. */
export async function getGroupBoard(
  group: GroupAccess & { id: string; slug: string },
  boardId: string,
  viewer: SessionUser | null,
): Promise<{ board: BoardSummary; access: BoardAccess } | null> {
  await connectToDatabase();
  const id = toObjectId(boardId);
  const groupId = toObjectId(group.id);
  if (!id || !groupId) return null;
  const doc = (await Board.findOne({ _id: id, groupId, hidden: { $ne: true } } as never)
    .select({ removed: 0, removedArrows: 0 })
    .lean()) as BoardDoc | null;
  if (!doc) return null;

  const access: BoardAccess = {
    ownerType: "groupe",
    visibility: doc.visibility as BoardVisibility,
    group,
  };
  if (!canSeeBoard(viewer, access)) return null;
  return { board: await toSummary(doc, groupBoardPath(group.slug, boardId)), access };
}

/** Le panneau d'un lieu, s'il en a ouvert un. */
export async function getPlaceBoard(place: { id: string; slug: string }): Promise<BoardSummary | null> {
  await connectToDatabase();
  const placeId = toObjectId(place.id);
  if (!placeId) return null;
  const doc = (await Board.findOne({ placeId, hidden: { $ne: true } } as never)
    .select({ removed: 0, removedArrows: 0 })
    .lean()) as BoardDoc | null;
  if (!doc) return null;
  return toSummary(doc, placeBoardPath(place.slug));
}
