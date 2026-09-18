import "server-only";

import { cache } from "react";

import type { PlaceType, Region } from "@/lib/domain";
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

/** Combien d'évènements à venir se tiennent dans chacun de ces lieux. */
async function countUpcomingEvents(placeIds: unknown[]) {
  if (placeIds.length === 0) return new Map<string, number>();
  const rows = await Event.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        placeId: { $in: placeIds },
        hidden: { $ne: true },
        startsAt: { $gte: new Date() },
      },
    },
    { $group: { _id: "$placeId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.count]));
}

export async function listPlaces(options: ListOptions = {}) {
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

  const [docs, total] = await Promise.all([
    Place.find(filter as never)
      .sort({ name: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Place.countDocuments(filter as never),
  ]);

  const counts = await countUpcomingEvents(docs.map((doc) => doc._id));

  return {
    items: docs.map((doc) => ({
      ...baseSummary(doc as PlaceDocument & { _id: unknown }),
      upcomingEventCount: counts.get(String(doc._id)) ?? 0,
    })),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/** Tous les lieux épinglables sur la carte — la carte les charge d'un coup. */
export async function listPlacesForMap() {
  await connectToDatabase();
  const docs = await Place.find({ hidden: { $ne: true } })
    .sort({ name: 1 })
    .lean();
  const counts = await countUpcomingEvents(docs.map((doc) => doc._id));
  return docs.map((doc) => ({
    ...baseSummary(doc as PlaceDocument & { _id: unknown }),
    upcomingEventCount: counts.get(String(doc._id)) ?? 0,
  }));
}

export const getPlaceBySlug = cache(async (slug: string): Promise<PlaceDetail | null> => {
  await connectToDatabase();

  const doc = await Place.findOne({ slug, hidden: { $ne: true } }).lean();
  if (!doc) return null;

  const [authors, keeper, counts] = await Promise.all([
    loadAuthors([doc.authorId]),
    doc.keeperCharacterId
      ? Character.findById(doc.keeperCharacterId).select({ name: 1, slug: 1 }).lean()
      : Promise.resolve(null),
    countUpcomingEvents([doc._id]),
  ]);

  const points = (doc.floorPlan?.points ?? []).map((point) => ({
    number: point.number,
    label: point.label,
    description: point.description ?? null,
    x: point.x,
    y: point.y,
  }));

  return {
    ...baseSummary(doc as PlaceDocument & { _id: unknown }),
    upcomingEventCount: counts.get(String(doc._id)) ?? 0,
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
    keeper: keeper
      ? { id: String(keeper._id), slug: keeper.slug, name: keeper.name }
      : null,
    author: authors.get(doc.authorId) ?? null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
});

export async function listPlaceOptions() {
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
}

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
