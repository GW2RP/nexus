import "server-only";

import { cache } from "react";

import type { Race } from "@/lib/domain";
import { TAGS, remember } from "@/server/queries/cache";
import { Character, type CharacterDocument } from "@/models/character";
import { Place } from "@/models/place";
import {
  type QueryFilter,
  PAGE_SIZE,
  connectToDatabase,
  loadAuthors,
  searchRegex,
  toIso,
  toObjectId,
} from "@/server/queries/shared";
import type { CharacterDetail, CharacterSummary } from "@/server/types";

export type CharacterSort = "recents" | "alphabetique" | "anciens";

const SORTS: Record<CharacterSort, Record<string, 1 | -1>> = {
  recents: { createdAt: -1 },
  alphabetique: { name: 1 },
  anciens: { age: -1 },
};

type ListOptions = {
  query?: string;
  race?: Race;
  sort?: CharacterSort;
  withPortrait?: boolean;
  authorId?: string;
  page?: number;
  pageSize?: number;
};

function toSummary(doc: CharacterDocument & { _id: unknown }): CharacterSummary {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    race: doc.race as Race,
    gender: (doc.gender ?? "neutre") as CharacterSummary["gender"],
    age: typeof doc.age === "number" ? doc.age : null,
    title: doc.title ?? null,
    summary: doc.summary ?? null,
    homePlaceLabel: doc.homePlaceLabel ?? null,
    portraitUrl: doc.portraitUrl ?? null,
    portraitAlt: doc.portraitAlt ?? null,
    authorId: doc.authorId,
  };
}

/** Le registre, filtré et paginé. Cachée par jeu d'options : une race, un tri
 *  et une page forment leur propre entrée, et un retour en arrière ne repart
 *  pas jusqu'à Atlas. */
export const listCharacters = remember(
  async function listCharacters(options: ListOptions = {}) {
    await connectToDatabase();

    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = Math.max(1, options.page ?? 1);
    const filter: QueryFilter = { hidden: { $ne: true } };

    if (options.race) filter.race = options.race;
    if (options.authorId) filter.authorId = options.authorId;
    if (options.withPortrait) filter.portraitUrl = { $nin: [null, ""] };
    if (options.query) {
      const regex = searchRegex(options.query);
      filter.$or = [{ name: regex }, { title: regex }, { summary: regex }];
    }

    const [docs, total] = await Promise.all([
      Character.find(filter as never)
        .sort(SORTS[options.sort ?? "recents"])
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Character.countDocuments(filter as never),
    ]);

    return {
      items: docs.map((doc) => toSummary(doc as CharacterDocument & { _id: unknown })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  },
  ["characters:list"],
  [TAGS.characters],
);

/** Le sous-titre du registre : combien de fiches, et combien depuis un trimestre.
 *
 *  Un seul aller-retour plutôt que deux `countDocuments` : les deux comptes
 *  lisent la même collection avec le même filtre de base, et `$facet` les tire
 *  d'un seul passage.
 *
 *  La fenêtre de quatre-vingt-dix jours se referme d'elle-même : c'est la seule
 *  lecture du hub dont le résultat change sans que personne n'écrive, donc la
 *  seule qui a besoin d'une horloge. Une heure suffit pour un compte affiché
 *  en sous-titre. */
export const countCharacters = remember(
  async function countCharacters() {
    await connectToDatabase();
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [row] = await Character.aggregate<{ total: number; recent: number }>([
      { $match: { hidden: { $ne: true } } },
      {
        $facet: {
          total: [{ $count: "n" }],
          recent: [{ $match: { createdAt: { $gte: since } } }, { $count: "n" }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ["$total.n", 0] }, 0] },
          recent: { $ifNull: [{ $arrayElemAt: ["$recent.n", 0] }, 0] },
        },
      },
    ]);

    return { total: row?.total ?? 0, recent: row?.recent ?? 0 };
  },
  ["characters:count"],
  [TAGS.characters],
  3600,
);

export const getCharacterBySlug = cache(async (slug: string): Promise<CharacterDetail | null> => {
  await connectToDatabase();

  const doc = await Character.findOne({ slug, hidden: { $ne: true } }).lean();
  if (!doc) return null;

  const [authors, haunts, authorCharacterCount] = await Promise.all([
    loadAuthors([doc.authorId]),
    doc.hauntsPlaceIds?.length
      ? Place.find({ _id: { $in: doc.hauntsPlaceIds }, hidden: { $ne: true } })
          .select({ name: 1, slug: 1 })
          .lean()
      : Promise.resolve([]),
    Character.countDocuments({ authorId: doc.authorId, hidden: { $ne: true } }),
  ]);

  const summary = toSummary(doc as CharacterDocument & { _id: unknown });

  return {
    ...summary,
    tagline: doc.tagline ?? null,
    story: doc.story ?? null,
    appearance: doc.appearance ?? null,
    birthplace: doc.birthplace ?? null,
    birthDate: doc.birthDate ?? null,
    occupation: doc.occupation ?? null,
    status: doc.status ?? null,
    region: (doc.homeRegion ?? null) as CharacterDetail["region"],
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
    author: authors.get(doc.authorId) ?? null,
    authorCharacterCount,
    haunts: haunts.map((place) => ({
      id: String(place._id),
      slug: place.slug,
      name: place.name,
      note: null,
    })),
  };
});

export async function getCharacterById(id: string) {
  await connectToDatabase();
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const doc = await Character.findById(objectId).lean();
  return doc ? toSummary(doc as CharacterDocument & { _id: unknown }) : null;
}

/** Les personnages d'un compte : le choix proposé au moment de colporter une rumeur
 *  ou de s'inscrire à un évènement. */
export async function listCharactersOf(authorId: string) {
  await connectToDatabase();
  const docs = await Character.find({ authorId, hidden: { $ne: true } })
    .sort({ name: 1 })
    .lean();
  return docs.map((doc) => toSummary(doc as CharacterDocument & { _id: unknown }));
}

/** Les personnages de plusieurs comptes, avec le compte qui les tient : le choix
 *  de « tenu par » d'un lieu, où l'auteur et ses co-gérants prêtent les leurs. */
export async function listCharactersOfMany(authorIds: string[]) {
  await connectToDatabase();
  const owners = [...new Set(authorIds)].filter(Boolean);
  if (owners.length === 0) return [];

  const docs = await Character.find({ authorId: { $in: owners }, hidden: { $ne: true } })
    .select({ name: 1, authorId: 1 })
    .sort({ name: 1 })
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    authorId: doc.authorId,
  }));
}

export async function listCharacterSlugs() {
  await connectToDatabase();
  const docs = await Character.find({ hidden: { $ne: true } })
    .select({ slug: 1, updatedAt: 1 })
    .lean();
  return docs.map((doc) => ({ slug: doc.slug, updatedAt: toIso(doc.updatedAt) }));
}
