import "server-only";

import { cache } from "react";

import type { EventType, Gender, Race, Region } from "@/lib/domain";
import { Character } from "@/models/character";
import { Event, type EventDocument } from "@/models/event";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import { type QueryFilter, connectToDatabase, loadAuthors, toIso, toIsoOrNull } from "@/server/queries/shared";
import type { EventDetail, EventSummary } from "@/server/types";

type ListOptions = {
  type?: EventType;
  region?: Region;
  placeId?: string;
  /** Ne garder que les évènements auxquels ce compte est inscrit. */
  registeredFor?: string;
  from?: Date;
  to?: Date;
  includePast?: boolean;
  limit?: number;
  viewerId?: string | null;
  authorId?: string;
};

type PlaceLite = { _id: unknown; name: string; slug: string; district?: string | null };

function locationLabel(doc: EventDocument, place: PlaceLite | undefined): string {
  if (place) {
    return place.district ? `${place.name}, ${place.district}` : place.name;
  }
  return doc.freeLocationLabel ?? "Lieu à préciser";
}

export async function listEvents(options: ListOptions = {}): Promise<EventSummary[]> {
  await connectToDatabase();

  const filter: QueryFilter = { hidden: { $ne: true } };
  if (options.type) filter.type = options.type;
  if (options.region) filter.region = options.region;
  if (options.placeId) filter.placeId = options.placeId;
  if (options.authorId) filter.authorId = options.authorId;

  if (options.from || options.to || !options.includePast) {
    const window: { $gte?: Date; $lte?: Date } = {};
    if (options.from) window.$gte = options.from;
    else if (!options.includePast) window.$gte = new Date();
    if (options.to) window.$lte = options.to;
    filter.startsAt = window;
  }

  if (options.registeredFor) {
    const registrations = await Registration.find({ userId: options.registeredFor })
      .select({ eventId: 1 })
      .lean();
    filter._id = { $in: registrations.map((registration) => registration.eventId) };
  }

  const query = Event.find(filter as never).sort({ startsAt: 1 });
  if (options.limit) query.limit(options.limit);
  const docs = await query.lean();

  return hydrateEvents(docs as (EventDocument & { _id: unknown })[], options.viewerId ?? null);
}

async function hydrateEvents(
  docs: (EventDocument & { _id: unknown })[],
  viewerId: string | null,
): Promise<EventSummary[]> {
  if (docs.length === 0) return [];

  const placeIds = docs.map((doc) => doc.placeId).filter(Boolean);
  const eventIds = docs.map((doc) => doc._id);
  const now = Date.now();

  const [places, counts, viewerRegistrations] = await Promise.all([
    placeIds.length
      ? Place.find({ _id: { $in: placeIds } }).select({ name: 1, slug: 1, district: 1 }).lean()
      : Promise.resolve([]),
    Registration.aggregate<{ _id: unknown; count: number }>([
      { $match: { eventId: { $in: eventIds }, status: "inscrit" } },
      { $group: { _id: "$eventId", count: { $sum: 1 } } },
    ]),
    viewerId
      ? Registration.find({ eventId: { $in: eventIds }, userId: viewerId } as never)
          .select({ eventId: 1, status: 1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const placeById = new Map(places.map((place) => [String(place._id), place as PlaceLite]));
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  const viewerById = new Map(
    viewerRegistrations.map((registration) => [
      String(registration.eventId),
      registration.status as "inscrit" | "liste-attente",
    ]),
  );

  return docs.map((doc) => {
    const place = doc.placeId ? placeById.get(String(doc.placeId)) : undefined;
    const startsAt = new Date(doc.startsAt).getTime();
    // Sans heure de fin, une scène est réputée durer trois heures.
    const endsAt = doc.endsAt ? new Date(doc.endsAt).getTime() : startsAt + 3 * 3_600_000;
    const liveStatus =
      now < startsAt ? ("annonce" as const) : now <= endsAt ? ("en-cours" as const) : ("passe" as const);

    return {
      id: String(doc._id),
      slug: doc.slug,
      title: doc.title,
      type: doc.type as EventType,
      summary: doc.summary ?? null,
      startsAt: toIso(doc.startsAt),
      endsAt: toIsoOrNull(doc.endsAt),
      region: (doc.region ?? null) as Region | null,
      locationLabel: locationLabel(doc, place),
      place: place ? { id: String(place._id), slug: place.slug, name: place.name } : null,
      coordinates:
        typeof doc.coordinates?.x === "number" && typeof doc.coordinates?.y === "number"
          ? { x: doc.coordinates.x, y: doc.coordinates.y }
          : null,
      capacity: typeof doc.capacity === "number" ? doc.capacity : null,
      registeredCount: countById.get(String(doc._id)) ?? 0,
      viewerStatus: viewerById.get(String(doc._id)) ?? null,
      liveStatus,
      authorId: doc.authorId,
      bannerUrl: doc.bannerUrl ?? null,
      pinned: Boolean(doc.pinned),
    };
  });
}

export const getEventBySlug = cache(
  async (slug: string, viewerId: string | null = null): Promise<EventDetail | null> => {
    await connectToDatabase();

    const doc = await Event.findOne({ slug, hidden: { $ne: true } }).lean();
    if (!doc) return null;

    const [summary] = await hydrateEvents([doc as EventDocument & { _id: unknown }], viewerId);

    const [authors, organiser, place, registrations] = await Promise.all([
      loadAuthors([doc.authorId]),
      doc.organiserCharacterId
        ? Character.findById(doc.organiserCharacterId)
            .select({ name: 1, slug: 1, race: 1, gender: 1, age: 1, title: 1 })
            .lean()
        : Promise.resolve(null),
      doc.placeId
        ? Place.findById(doc.placeId)
            .select({ name: 1, slug: 1, district: 1, summary: 1, region: 1 })
            .lean()
        : Promise.resolve(null),
      Registration.find({ eventId: doc._id, status: "inscrit" })
        .sort({ createdAt: 1 })
        .lean(),
    ]);

    const characterIds = registrations
      .map((registration) => registration.characterId)
      .filter(Boolean);
    const characters = characterIds.length
      ? await Character.find({ _id: { $in: characterIds } })
          .select({ name: 1, slug: 1, race: 1, gender: 1 })
          .lean()
      : [];

    return {
      ...summary,
      description: doc.description ?? null,
      practicalNotes: (doc.practicalNotes ?? []).filter(Boolean),
      bannerAlt: doc.bannerAlt ?? null,
      organiser: organiser
        ? {
            id: String(organiser._id),
            slug: organiser.slug,
            name: organiser.name,
            race: organiser.race as Race,
            gender: (organiser.gender ?? "neutre") as Gender,
            age: typeof organiser.age === "number" ? organiser.age : null,
            title: organiser.title ?? null,
          }
        : null,
      author: authors.get(doc.authorId) ?? null,
      placeDetail: place
        ? {
            id: String(place._id),
            slug: place.slug,
            name: place.name,
            district: place.district ?? null,
            summary: place.summary ?? null,
            region: place.region as Region,
          }
        : null,
      participants: characters.map((character) => ({
        id: String(character._id),
        slug: character.slug,
        name: character.name,
        race: character.race as Race,
        gender: (character.gender ?? "neutre") as Gender,
      })),
      createdAt: toIso(doc.createdAt),
      updatedAt: toIso(doc.updatedAt),
    };
  },
);

export async function countUpcomingEvents(from: Date, to: Date) {
  await connectToDatabase();
  return Event.countDocuments({
    hidden: { $ne: true },
    startsAt: { $gte: from, $lte: to },
  });
}

export async function listEventSlugs() {
  await connectToDatabase();
  const docs = await Event.find({ hidden: { $ne: true } })
    .select({ slug: 1, updatedAt: 1 })
    .lean();
  return docs.map((doc) => ({ slug: doc.slug, updatedAt: toIso(doc.updatedAt) }));
}
