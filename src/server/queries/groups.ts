import "server-only";

import { cache } from "react";

import type { GroupVisibility } from "@/lib/domain";
import { canSeeGroup, isGroupMember } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Event } from "@/models/event";
import { Group, type GroupDocument } from "@/models/group";
import {
  type QueryFilter,
  connectToDatabase,
  loadAuthors,
  searchRegex,
  toIso,
} from "@/server/queries/shared";
import type { GroupDetail, GroupSummary } from "@/server/types";

type GroupDoc = GroupDocument & { _id: unknown };

/** Les groupes d'un compte, pour décider ce qu'il voit.
 *
 *  Mémoïsée pour la requête, jamais rangée dans le cache de lecture : c'est ce
 *  qui décide de l'accès à une scène privée, et une appartenance retirée doit
 *  l'être au rendu suivant, pas quand l'étiquette voudra bien tomber. */
export const groupIdsOf = cache(async (userId: string | null): Promise<string[]> => {
  if (!userId) return [];
  await connectToDatabase();
  const docs = await Group.find({
    hidden: { $ne: true },
    $or: [{ authorId: userId }, { memberIds: userId }],
  } as never)
    .select({ _id: 1 })
    .lean();
  return docs.map((doc) => String(doc._id));
});

/** Ce qu'un lecteur a le droit de voir : les groupes publics, et les siens. */
function visibilityFilter(viewer: SessionUser | null): QueryFilter {
  const clauses: QueryFilter[] = [{ visibility: "public" }];
  if (viewer) {
    clauses.push({ authorId: viewer.id });
    clauses.push({ memberIds: viewer.id });
  }
  return { $or: clauses };
}

/** Les scènes à venir de chaque groupe, en une requête. Les séances retirées et
 *  les séries en pause n'y sont pas : elles ne se tiennent plus. */
async function upcomingByGroup(groupIds: unknown[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await Event.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        groupId: { $in: groupIds },
        hidden: { $ne: true },
        cancelledAt: null,
        seriesPausedAt: null,
        startsAt: { $gte: new Date() },
      },
    },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

function baseSummary(
  doc: GroupDoc,
  viewer: SessionUser | null,
  author: GroupSummary["author"],
  upcoming: number,
): GroupSummary {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    visibility: doc.visibility as GroupVisibility,
    summary: doc.summary ?? null,
    bannerUrl: doc.bannerUrl ?? null,
    bannerAlt: doc.bannerAlt ?? null,
    // Le meneur est membre de droit : il compte, mais ne figure pas dans la liste.
    memberCount: (doc.memberIds ?? []).length + 1,
    upcomingEventCount: upcoming,
    authorId: doc.authorId,
    author,
    viewerIsMember: isGroupMember(viewer, {
      visibility: doc.visibility as GroupVisibility,
      authorId: doc.authorId,
      memberIds: doc.memberIds ?? [],
    }),
  };
}

export async function listGroups(
  options: { viewer?: SessionUser | null; query?: string; mine?: boolean } = {},
): Promise<GroupSummary[]> {
  await connectToDatabase();
  const viewer = options.viewer ?? null;

  const filter: QueryFilter = { hidden: { $ne: true } };
  if (options.mine && viewer) {
    filter.$or = [{ authorId: viewer.id }, { memberIds: viewer.id }];
  } else {
    Object.assign(filter, visibilityFilter(viewer));
  }
  if (options.query?.trim()) {
    filter.name = searchRegex(options.query);
  }

  const docs = (await Group.find(filter as never).sort({ name: 1 }).limit(60).lean()) as GroupDoc[];
  const [authors, upcoming] = await Promise.all([
    loadAuthors(docs.map((doc) => doc.authorId)),
    upcomingByGroup(docs.map((doc) => doc._id)),
  ]);

  return docs.map((doc) =>
    baseSummary(doc, viewer, authors.get(doc.authorId) ?? null, upcoming.get(String(doc._id)) ?? 0),
  );
}

/** Un groupe, ou `null` quand le lecteur n'a pas à savoir qu'il existe :
 *  un groupe privé est introuvable pour qui n'en est pas. */
export const getGroupBySlug = cache(
  async (slug: string, viewer: SessionUser | null = null): Promise<GroupDetail | null> => {
    await connectToDatabase();

    const doc = (await Group.findOne({ slug, hidden: { $ne: true } }).lean()) as GroupDoc | null;
    if (!doc) return null;

    const memberIds = doc.memberIds ?? [];
    const access = {
      visibility: doc.visibility as GroupVisibility,
      authorId: doc.authorId,
      memberIds,
    };
    if (!canSeeGroup(viewer, access)) return null;

    const [authors, upcoming] = await Promise.all([
      loadAuthors([doc.authorId, ...memberIds]),
      upcomingByGroup([doc._id]),
    ]);

    return {
      ...baseSummary(doc, viewer, authors.get(doc.authorId) ?? null, upcoming.get(String(doc._id)) ?? 0),
      description: doc.description ?? null,
      // Un compte supprimé depuis son entrée dans le cercle n'a plus de nom à
      // montrer : on ne lui en invente pas, on ne le liste plus.
      members: memberIds
        .map((id) => authors.get(id))
        .filter((member): member is NonNullable<typeof member> => Boolean(member)),
      createdAt: toIso(doc.createdAt),
      updatedAt: toIso(doc.updatedAt),
    };
  },
);

/** Les groupes qu'un compte mène : le choix proposé quand on associe un groupe
 *  à une scène. On ne propose pas un groupe dont on n'est que membre —
 *  y annoncer une scène reviendrait à écrire chez quelqu'un d'autre. */
export async function listGroupsLedBy(userId: string) {
  await connectToDatabase();
  const docs = (await Group.find({ authorId: userId, hidden: { $ne: true } })
    .sort({ name: 1 })
    .select({ name: 1, slug: 1, memberIds: 1 })
    .lean()) as GroupDoc[];
  return docs.map((doc) => ({
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    memberCount: (doc.memberIds ?? []).length + 1,
  }));
}

export async function listGroupSlugs() {
  await connectToDatabase();
  const docs = await Group.find({ hidden: { $ne: true }, visibility: "public" })
    .select({ slug: 1, updatedAt: 1 })
    .lean();
  return docs.map((doc) => ({ slug: doc.slug, updatedAt: toIso(doc.updatedAt) }));
}
