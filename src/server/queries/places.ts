import "server-only";

import { cache } from "react";

import type { PlaceType, Region } from "@/lib/domain";
import { TAGS, remember } from "@/server/queries/cache";
import { pasEncoreFini } from "@/server/queries/events";
import { Character } from "@/models/character";
import { Event } from "@/models/event";
import { Place, type PlaceDocument } from "@/models/place";
import {
  type QueryFilter,
  PAGE_SIZE,
  connectToDatabase,
  loadAuthors,
  searchRegex,
  toIso,
} from "@/server/queries/shared";
import type { PlaceDetail, PlaceSummary } from "@/server/types";

type ListOptions = {
  query?: string;
  type?: PlaceType;
  region?: Region;
  authorId?: string;
  page?: number;
  pageSize?: number;
};

function baseSummary(doc: PlaceDocument & { _id: unknown }): Omit<PlaceSummary, "upcomingEventCount"> {
  return {
    id: String(doc._id),
    slug: doc.slug,
    name: doc.name,
    type: doc.type as PlaceType,
    region: doc.region as Region,
    district: doc.district ?? null,
    summary: doc.summary ?? null,
    bannerUrl: doc.bannerUrl ?? null,
    bannerAlt: doc.bannerAlt ?? null,
    coordinates:
      typeof doc.coordinates?.x === "number" && typeof doc.coordinates?.y === "number"
        ? { x: doc.coordinates.x, y: doc.coordinates.y }
        : null,
    authorId: doc.authorId,
  };
}

/** Combien d'évènements à venir se tiennent dans chaque lieu.
 *
 *  Le compte porte sur **tous** les lieux d'un coup, sans `$in` sur la page
 *  qu'on affiche : autrement il fallait connaître les lieux avant de le lancer,
 *  et l'aller-retour venait s'ajouter au bout de celui de la liste au lieu de
 *  partir avec. Le hub compte ses lieux par dizaines, pas par milliers — un
 *  groupement complet coûte moins cher qu'un tour de plus.
 *
 *  « À venir » se juge sur l'heure qu'il est, donc aucune écriture ne vient
 *  l'invalider en passant : cinq minutes d'horloge par-dessus l'étiquette des
 *  évènements, pour une pastille qui dit « 2 évènements à venir ». */
const upcomingEventsByPlace = remember(
  async function upcomingEventsByPlace(): Promise<Record<string, number>> {
    await connectToDatabase();
    const rows = await Event.aggregate<{ _id: unknown; count: number }>([
      // La même définition qu'à l'agenda : une scène commencée se tient encore,
      // donc elle compte. Sans cela, la fiche d'un lieu cesserait de l'annoncer
      // à l'heure précise où elle y commence.
      {
        $match: {
          placeId: { $ne: null },
          hidden: { $ne: true },
          cancelledAt: null,
          seriesPausedAt: null,
          ...pasEncoreFini(),
        },
      },
      { $group: { _id: "$placeId", count: { $sum: 1 } } },
    ]);
    // Un objet simple, pas une `Map` : le cache sérialise ce qu'il range.
    return Object.fromEntries(rows.map((row) => [String(row._id), row.count]));
  },
  ["places:upcoming-events"],
  [TAGS.events],
  300,
);

/** Le registre des lieux, filtré et paginé.
 *
 *  Deux étiquettes : la fiche d'un lieu vient de `lieux`, mais la pastille
 *  « évènements à venir » vient de `evenements`. Sans la seconde, annoncer une
 *  scène ne mettrait pas à jour le compte affiché sur son lieu. */
export const listPlaces = remember(
  async function listPlaces(options: ListOptions = {}) {
    await connectToDatabase();

    const pageSize = options.pageSize ?? PAGE_SIZE;
    const page = Math.max(1, options.page ?? 1);
    const filter: QueryFilter = { hidden: { $ne: true } };

    if (options.type) filter.type = options.type;
    if (options.region) filter.region = options.region;
    if (options.authorId) filter.authorId = options.authorId;
    if (options.query) {
      const regex = searchRegex(options.query);
      filter.$or = [{ name: regex }, { summary: regex }, { district: regex }];
    }

    const [docs, total, counts] = await Promise.all([
      Place.find(filter as never)
        .sort({ name: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Place.countDocuments(filter as never),
      upcomingEventsByPlace(),
    ]);

    return {
      items: docs.map((doc) => ({
        ...baseSummary(doc as PlaceDocument & { _id: unknown }),
        upcomingEventCount: counts[String(doc._id)] ?? 0,
      })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  },
  ["places:list"],
  [TAGS.places, TAGS.events],
);

/** Tous les lieux épinglables sur la carte — la carte les charge d'un coup. */
export const listPlacesForMap = remember(
  async function listPlacesForMap() {
    await connectToDatabase();
    const [docs, counts] = await Promise.all([
      Place.find({ hidden: { $ne: true } }).sort({ name: 1 }).lean(),
      upcomingEventsByPlace(),
    ]);
    return docs.map((doc) => ({
      ...baseSummary(doc as PlaceDocument & { _id: unknown }),
      upcomingEventCount: counts[String(doc._id)] ?? 0,
    }));
  },
  ["places:map"],
  [TAGS.places, TAGS.events],
);

export const getPlaceBySlug = cache(async (slug: string): Promise<PlaceDetail | null> => {
  await connectToDatabase();

  const doc = await Place.findOne({ slug, hidden: { $ne: true } }).lean();
  if (!doc) return null;

  // Le champ au singulier est celui des fiches écrites avant les co-tenanciers :
  // on le lit encore, à défaut de la liste, pour ne perdre aucun tenancier.
  const keeperIds =
    doc.keeperCharacterIds && doc.keeperCharacterIds.length > 0
      ? doc.keeperCharacterIds
      : doc.keeperCharacterId
        ? [doc.keeperCharacterId]
        : [];
  const managerIds = doc.managerIds ?? [];

  const [authors, keeperDocs, counts] = await Promise.all([
    loadAuthors([doc.authorId, ...managerIds]),
    keeperIds.length > 0
      ? Character.find({ _id: { $in: keeperIds }, hidden: { $ne: true } })
          .select({ name: 1, slug: 1 })
          .lean()
      : Promise.resolve([]),
    upcomingEventsByPlace(),
  ]);

  // Mongo rend les personnages dans son ordre à lui : on remet celui de l'auteur.
  const keepersById = new Map(
    keeperDocs.map((keeper) => [
      String(keeper._id),
      { id: String(keeper._id), slug: keeper.slug, name: keeper.name },
    ]),
  );

  const points = (doc.floorPlan?.points ?? []).map((point) => ({
    number: point.number,
    label: point.label,
    description: point.description ?? null,
    x: point.x,
    y: point.y,
  }));

  return {
    ...baseSummary(doc as PlaceDocument & { _id: unknown }),
    upcomingEventCount: counts[String(doc._id)] ?? 0,
    description: doc.description ?? null,
    access: doc.access ?? null,
    logoUrl: doc.logoUrl ?? null,
    floorPlan: doc.floorPlan?.imageUrl
      ? {
          imageUrl: doc.floorPlan.imageUrl,
          imageAlt: doc.floorPlan.imageAlt ?? null,
          width: doc.floorPlan.width ?? null,
          height: doc.floorPlan.height ?? null,
          points,
        }
      : points.length > 0
        ? { imageUrl: null, imageAlt: null, width: null, height: null, points }
        : null,
    keepers: keeperIds
      .map((id) => keepersById.get(String(id)))
      .filter((keeper) => keeper !== undefined),
    managers: managerIds
      .map((id) => authors.get(id))
      .filter((manager) => manager !== undefined),
    author: authors.get(doc.authorId) ?? null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
});

export const listPlaceOptions = remember(
  async function listPlaceOptions() {
    await connectToDatabase();
    const docs = await Place.find({ hidden: { $ne: true } })
      .select({ name: 1, slug: 1, region: 1 })
      .sort({ name: 1 })
      .lean();
    return docs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      region: doc.region as Region,
    }));
  },
  ["places:options"],
  [TAGS.places],
);

export async function listPlaceSlugs() {
  await connectToDatabase();
  const docs = await Place.find({ hidden: { $ne: true } })
    .select({ slug: 1, updatedAt: 1 })
    .lean();
  return docs.map((doc) => ({ slug: doc.slug, updatedAt: toIso(doc.updatedAt) }));
}

export async function countPlaces() {
  await connectToDatabase();
  return Place.countDocuments({ hidden: { $ne: true } });
}
