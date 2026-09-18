import "server-only";


import type { Region } from "@/lib/domain";
import { Character } from "@/models/character";
import { Place } from "@/models/place";
import { Rumor, type RumorDocument } from "@/models/rumor";
import {
  type QueryFilter,
  PAGE_SIZE,
  connectToDatabase,
  loadAuthors,
  toIso,
} from "@/server/queries/shared";
import type { RumorSummary } from "@/server/types";

export type RumorSort = "recentes" | "reprises";

type ListOptions = {
  region?: Region;
  sort?: RumorSort;
  characterId?: string;
  authorId?: string;
  page?: number;
  pageSize?: number;
  viewerId?: string | null;
};

async function hydrate(
  docs: (RumorDocument & { _id: unknown })[],
  viewerId: string | null,
): Promise<RumorSummary[]> {
  if (docs.length === 0) return [];

  const characterIds = docs.map((doc) => doc.characterId).filter(Boolean);
  const placeIds = docs.map((doc) => doc.placeId).filter(Boolean);

  type NamedDoc = { _id: unknown; name: string; slug: string };

  const [characters, places, authors] = await Promise.all([
    characterIds.length
      ? (Character.find({ _id: { $in: characterIds } })
          .select({ name: 1, slug: 1 })
          .lean() as unknown as Promise<NamedDoc[]>)
      : Promise.resolve([] as NamedDoc[]),
    placeIds.length
      ? (Place.find({ _id: { $in: placeIds } })
          .select({ name: 1, slug: 1 })
          .lean() as unknown as Promise<NamedDoc[]>)
      : Promise.resolve([] as NamedDoc[]),
    loadAuthors(docs.map((doc) => doc.authorId)),
  ]);

  const characterById = new Map(characters.map((item) => [String(item._id), item]));
  const placeById = new Map(places.map((item) => [String(item._id), item]));

  return docs.map((doc) => {
    const character = doc.characterId ? characterById.get(String(doc.characterId)) : undefined;
    const place = doc.placeId ? placeById.get(String(doc.placeId)) : undefined;
    return {
      id: String(doc._id),
      body: doc.body,
      character: character
        ? { id: String(character._id), slug: character.slug, name: character.name }
        : null,
      author: authors.get(doc.authorId) ?? null,
      place: place ? { id: String(place._id), slug: place.slug, name: place.name } : null,
      heardAtLabel: doc.heardAtLabel ?? null,
      region: (doc.region ?? null) as Region | null,
      echoCount: doc.echoCount ?? 0,
      viewerHasEchoed: viewerId ? (doc.echoedBy ?? []).includes(viewerId) : false,
      authorId: doc.authorId,
      createdAt: toIso(doc.createdAt),
    };
  });
}

export async function listRumors(options: ListOptions = {}) {
  await connectToDatabase();

  const pageSize = options.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, options.page ?? 1);
  const filter: QueryFilter = { hidden: { $ne: true } };
  if (options.region) filter.region = options.region;
  if (options.characterId) filter.characterId = options.characterId;
  if (options.authorId) filter.authorId = options.authorId;

  const sort: Record<string, -1 | 1> =
    options.sort === "reprises" ? { echoCount: -1, createdAt: -1 } : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Rumor.find(filter as never)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Rumor.countDocuments(filter as never),
  ]);

  return {
    items: await hydrate(docs as (RumorDocument & { _id: unknown })[], options.viewerId ?? null),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/** Les plus reprises — la colonne latérale du tableau des rumeurs. */
export async function listTopRumors(limit = 3) {
  await connectToDatabase();
  const docs = await Rumor.find({ hidden: { $ne: true }, echoCount: { $gt: 0 } })
    .sort({ echoCount: -1 })
    .limit(limit)
    .lean();
  return hydrate(docs as (RumorDocument & { _id: unknown })[], null);
}
