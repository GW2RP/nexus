import "server-only";

import type { ActivityBoard, PickableBoard } from "@/lib/discord-activity";
import {
  canContribute,
  canEditPlace,
  canSeeBoard,
  canWriteBoard,
} from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Board } from "@/models/board";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { loadBoard, type BoardDoc } from "@/server/boards";
import { activityGrantsBoard, type ActivityReadGrant } from "@/server/discord/activity";
import { serializeContent } from "@/server/queries/boards";
import { connectToDatabase } from "@/server/queries/shared";

/** Le panneau d'une activité. La lecture est accordée par l'instance — c'est
 *  le panneau que tout le salon regarde —, l'écriture reste celle du site : un
 *  membre du groupe, l'équipe du lieu. */
export async function activityBoardView(
  grant: ActivityReadGrant,
  viewer: SessionUser | null,
): Promise<ActivityBoard | null> {
  const loaded = await loadBoard(grant.boardId);
  if (!loaded) return null;
  const { doc, access } = loaded;
  // Celui qui l'a posé doit encore pouvoir le lire, ou le lecteur lui-même.
  if (!activityGrantsBoard(grant, grant.boardId, access) && !canSeeBoard(viewer, access)) return null;
  const owner =
    access.ownerType === "lieu"
      ? await Place.findById(doc.placeId).select({ name: 1 }).lean()
      : await Group.findById(doc.groupId).select({ name: 1 }).lean();
  const canWrite = canWriteBoard(viewer, access);
  return {
    id: String(doc._id),
    name: doc.name,
    ownerType: access.ownerType,
    ownerName: (owner as { name?: string } | null)?.name ?? "",
    path: loaded.path,
    revision: doc.revision ?? 0,
    content: await serializeContent(doc, viewer),
    canWrite,
    // Entre membres d'un groupe, le panneau est commun ; sur celui d'un lieu,
    // l'équipe fait le ménage.
    canModerate: access.ownerType === "groupe" ? canWrite : canEditPlace(viewer, access.place),
    canReport: canContribute(viewer),
  };
}

/** Les panneaux qu'un compte peut poser sur une activité : ceux des groupes
 *  dont il est, et ceux des lieux qu'il tient. Il les montre à tout le salon,
 *  donc il doit au moins pouvoir les lire lui-même. */
export async function listPickableBoards(user: SessionUser): Promise<PickableBoard[]> {
  await connectToDatabase();
  const [groups, places] = await Promise.all([
    Group.find({
      hidden: { $ne: true },
      $or: [{ authorId: user.id }, { memberIds: user.id }],
    } as never)
      .select({ name: 1, authorId: 1, memberIds: 1, visibility: 1 })
      .lean(),
    Place.find({
      hidden: { $ne: true },
      $or: [{ authorId: user.id }, { managerIds: user.id }],
    } as never)
      .select({ name: 1 })
      .lean(),
  ]);
  const groupsById = new Map(groups.map((group) => [String(group._id), group]));
  const placesById = new Map(places.map((place) => [String(place._id), place]));

  type Row = Pick<BoardDoc, "name" | "ownerType" | "groupId" | "placeId" | "visibility"> & { _id: unknown };
  const docs = (await Board.find({
    hidden: { $ne: true },
    $or: [{ groupId: { $in: groups.map((one) => one._id) } }, { placeId: { $in: places.map((one) => one._id) } }],
  } as never)
    .select({ name: 1, ownerType: 1, groupId: 1, placeId: 1, visibility: 1 })
    .sort({ updatedAt: -1 })
    .lean()) as Row[];

  const picked: PickableBoard[] = [];
  for (const doc of docs) {
    if (doc.ownerType === "lieu") {
      const place = placesById.get(String(doc.placeId));
      if (place) picked.push({ id: String(doc._id), name: doc.name, ownerType: "lieu", ownerName: place.name });
      continue;
    }
    const group = groupsById.get(String(doc.groupId));
    if (!group) continue;
    const visible = canSeeBoard(user, {
      ownerType: "groupe",
      visibility: doc.visibility as never,
      group: { visibility: group.visibility, authorId: group.authorId, memberIds: group.memberIds ?? [] },
    });
    if (visible) picked.push({ id: String(doc._id), name: doc.name, ownerType: "groupe", ownerName: group.name });
  }
  return picked;
}
