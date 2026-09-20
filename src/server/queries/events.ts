import "server-only";

import { cache } from "react";

import type { EventType, EventVisibility, Gender, MonthlyMode, Race, Recurrence, Region } from "@/lib/domain";
import { canSeeEvent } from "@/lib/permissions";
import { decrireSerie, OCCURRENCES_MAX } from "@/lib/recurrence";
import type { SessionUser } from "@/lib/session";
import { Character } from "@/models/character";
import { Event, type EventDocument } from "@/models/event";
import { EventSeries, type EventSeriesDocument } from "@/models/event-series";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import { groupIdsOf } from "@/server/queries/groups";
import {
  type QueryFilter,
  connectToDatabase,
  loadAuthors,
  toIso,
  toIsoOrNull,
  toObjectId,
} from "@/server/queries/shared";
import type { EventDetail, EventSeriesDetail, EventSummary } from "@/server/types";

type ListOptions = {
  type?: EventType;
  region?: Region;
  placeId?: string;
  groupId?: string;
  /** Ne garder que les évènements auxquels ce compte est inscrit. */
  registeredFor?: string;
  /** Ne garder que les scènes où ce personnage figure parmi les participants.
   *  C'est ce que montre sa fiche : son agenda à lui, pas celui du hub. */
  participantCharacterId?: string;
  from?: Date;
  to?: Date;
  includePast?: boolean;
  limit?: number;
  /** Le lecteur : il décide des scènes privées qui lui sont visibles. */
  viewer?: SessionUser | null;
  authorId?: string;
  /** « Publiques », « sur invitation », « mes groupes » : le filtre d'accès de
   *  l'agenda. Sans valeur, tout ce que le lecteur a le droit de voir. */
  access?: "publiques" | "invitation" | "groupes";
};

type PlaceLite = { _id: unknown; name: string; slug: string; district?: string | null };
type EventDoc = EventDocument & { _id: unknown };

/** Ce qu'une scène doit être pour se montrer sans condition.
 *
 *  `visibility: { $ne: "privee" }` et non `"publique"` : les annonces écrites
 *  avant cette fonctionnalité n'ont pas le champ, et un défaut de schéma ne
 *  s'applique qu'à l'écriture. Elles sont publiques, et doivent le rester sans
 *  qu'on les réécrive.
 *
 *  `cancelledAt: null` et `seriesPausedAt: null` attrapent aussi les documents
 *  qui n'ont pas le champ : en Mongo, `null` vaut « nul ou absent ». */
const TENUE: QueryFilter = { hidden: { $ne: true }, cancelledAt: null, seriesPausedAt: null };
const PUBLIQUE: QueryFilter = { ...TENUE, visibility: { $ne: "privee" } };

/** Les scènes qu'un lecteur a le droit de voir : les publiques, et les privées
 *  qui lui sont ouvertes.
 *
 *  L'administration n'a pas de passe-droit **ici** : elle lit une scène privée
 *  signalée par sa fiche, mais son agenda n'est pas celui de tout le monde. */
async function accessFilter(
  viewer: SessionUser | null,
  access: ListOptions["access"],
): Promise<QueryFilter> {
  const publique: QueryFilter = { visibility: { $ne: "privee" } };
  if (!viewer) return access === "publiques" || !access ? publique : { _id: { $in: [] } };

  const [groupIds, registrations] = await Promise.all([
    groupIdsOf(viewer.id),
    Registration.find({ userId: viewer.id }).select({ eventId: 1 }).lean(),
  ]);
  const groupObjectIds = groupIds.map(toObjectId).filter(Boolean);

  const parGroupe: QueryFilter = { visibility: "privee", groupId: { $in: groupObjectIds } };
  const parInvitation: QueryFilter = {
    visibility: "privee",
    $or: [
      { authorId: viewer.id },
      { invitedUserIds: viewer.id },
      { _id: { $in: registrations.map((registration) => registration.eventId) } },
    ],
  };

  if (access === "publiques") return publique;
  if (access === "groupes") return groupObjectIds.length ? parGroupe : { _id: { $in: [] } };
  if (access === "invitation") return parInvitation;

  return { $or: [publique, parInvitation, ...(groupObjectIds.length ? [parGroupe] : [])] };
}

export async function listEvents(options: ListOptions = {}): Promise<EventSummary[]> {
  await connectToDatabase();
  const viewer = options.viewer ?? null;

  const filter: QueryFilter = { ...TENUE };
  if (options.type) filter.type = options.type;
  if (options.region) filter.region = options.region;
  if (options.placeId) filter.placeId = options.placeId;
  if (options.groupId) filter.groupId = toObjectId(options.groupId);
  if (options.authorId) filter.authorId = options.authorId;

  if (options.from || options.to || !options.includePast) {
    const window: { $gte?: Date; $lte?: Date } = {};
    if (options.from) window.$gte = options.from;
    else if (!options.includePast) window.$gte = new Date();
    if (options.to) window.$lte = options.to;
    filter.startsAt = window;
  }

  // Les restrictions par inscription se posent chacune dans sa clause : deux
  // `_id` dans le même objet s'écraseraient, et la seconde seule vaudrait.
  const parInscription: QueryFilter[] = [];

  if (options.registeredFor) {
    const registrations = await Registration.find({ userId: options.registeredFor })
      .select({ eventId: 1 })
      .lean();
    parInscription.push({ _id: { $in: registrations.map((registration) => registration.eventId) } });
  }

  if (options.participantCharacterId) {
    const characterId = toObjectId(options.participantCharacterId);
    const registrations = characterId
      ? await Registration.find({ characterId, status: "inscrit" } as never)
          .select({ eventId: 1 })
          .lean()
      : [];
    parInscription.push({ _id: { $in: registrations.map((registration) => registration.eventId) } });
  }

  // Le filtre d'accès s'ajoute par `$and` : il porte ses propres `$or`, et
  // les fondre dans le filtre écraserait l'un ou l'autre.
  const query = Event.find({
    $and: [filter, ...parInscription, await accessFilter(viewer, options.access)],
  } as never).sort({ startsAt: 1 });
  if (options.limit) query.limit(options.limit);
  const docs = await query.lean();

  return hydrateEvents(docs as EventDoc[], viewer?.id ?? null);
}

async function hydrateEvents(docs: EventDoc[], viewerId: string | null): Promise<EventSummary[]> {
  if (docs.length === 0) return [];

  const placeIds = docs.map((doc) => doc.placeId).filter(Boolean);
  const groupIds = docs.map((doc) => doc.groupId).filter(Boolean);
  const seriesIds = docs.map((doc) => doc.seriesId).filter(Boolean);
  const eventIds = docs.map((doc) => doc._id);
  const now = Date.now();

  const [places, groups, series, counts, viewerRegistrations] = await Promise.all([
    placeIds.length
      ? Place.find({ _id: { $in: placeIds } }).select({ name: 1, slug: 1, district: 1 }).lean()
      : Promise.resolve([]),
    groupIds.length
      ? Group.find({ _id: { $in: groupIds } }).select({ name: 1, slug: 1 }).lean()
      : Promise.resolve([]),
    seriesIds.length
      ? EventSeries.find({ _id: { $in: seriesIds } }).select({ recurrence: 1, pausedAt: 1 }).lean()
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
  const groupById = new Map(groups.map((group) => [String(group._id), group]));
  const seriesById = new Map(series.map((one) => [String(one._id), one]));
  const countById = new Map(counts.map((row) => [String(row._id), row.count]));
  const viewerById = new Map(
    viewerRegistrations.map((registration) => [
      String(registration.eventId),
      registration.status as "inscrit" | "liste-attente",
    ]),
  );

  return docs.map((doc) => {
    const place = doc.placeId ? placeById.get(String(doc.placeId)) : undefined;
    const group = doc.groupId ? groupById.get(String(doc.groupId)) : undefined;
    const one = doc.seriesId ? seriesById.get(String(doc.seriesId)) : undefined;
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
      locationLabel: place
        ? place.district
          ? `${place.name}, ${place.district}`
          : place.name
        : (doc.freeLocationLabel ?? "Lieu à préciser"),
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
      visibility: (doc.visibility ?? "publique") as EventVisibility,
      group: group ? { id: String(group._id), slug: group.slug, name: group.name } : null,
      series: one
        ? {
            id: String(one._id),
            recurrence: one.recurrence as Recurrence,
            paused: Boolean(one.pausedAt),
          }
        : null,
      occurrenceIndex: typeof doc.occurrenceIndex === "number" ? doc.occurrenceIndex : null,
      cancelled: Boolean(doc.cancelledAt),
    };
  });
}

function toSeriesDetail(doc: EventSeriesDocument & { _id: unknown }): EventSeriesDetail {
  // Une série sans compte promis s'arrête à la borne dure ; une série qui en a
  // un s'arrête là, et son bouton « prolonger » disparaît au bon moment.
  const plafond = doc.maxOccurrences ?? OCCURRENCES_MAX;
  return {
    id: String(doc._id),
    recurrence: doc.recurrence as Exclude<Recurrence, "aucune">,
    monthlyMode: (doc.monthlyMode ?? "quantieme") as MonthlyMode,
    rule: decrireSerie(new Date(doc.anchorAt), {
      recurrence: doc.recurrence as Exclude<Recurrence, "aucune">,
      monthlyMode: (doc.monthlyMode ?? "quantieme") as MonthlyMode,
      until: doc.until ? new Date(doc.until) : null,
    }),
    paused: Boolean(doc.pausedAt),
    until: toIsoOrNull(doc.until),
    occurrenceCount: doc.occurrenceCount ?? 0,
    maxOccurrences: doc.maxOccurrences ?? null,
    canExtend: !doc.until && (doc.occurrenceCount ?? 0) < plafond,
  };
}

/** Une scène entière — ou `null` quand le lecteur n'a pas à savoir qu'elle
 *  existe. Une annonce privée ne se devine pas en essayant des adresses :
 *  refuser l'accès et ne rien trouver s'écrivent de la même façon. */
async function loadEvent(
  doc: EventDoc,
  viewer: SessionUser | null,
  withShareCode: boolean,
): Promise<EventDetail | null> {
  const invitedUserIds = doc.invitedUserIds ?? [];
  const access = {
    visibility: (doc.visibility ?? "publique") as EventVisibility,
    authorId: doc.authorId,
    invitedUserIds,
    groupId: doc.groupId ? String(doc.groupId) : null,
  };

  // L'inscription et les groupes ne se chargent que pour une scène privée :
  // une annonce ouverte n'a rien à vérifier.
  if (access.visibility === "privee" && !withShareCode) {
    const [groupIds, registered] = await Promise.all([
      groupIdsOf(viewer?.id ?? null),
      viewer
        ? Registration.exists({ eventId: doc._id, userId: viewer.id } as never).then(Boolean)
        : Promise.resolve(false),
    ]);
    if (!canSeeEvent(viewer, access, { groupIds, registered })) return null;
  }

  const [summary] = await hydrateEvents([doc], viewer?.id ?? null);

  // Le code de partage et la liste des invités ne sortent que pour qui peut
  // modifier la scène — son auteur, et l'administration : les donner à un
  // invité reviendrait à le laisser inviter à son tour.
  const manages = Boolean(viewer && (viewer.id === doc.authorId || viewer.role === "administration"));

  const [authors, organiser, place, registrations, series] = await Promise.all([
    loadAuthors([doc.authorId, ...(manages ? invitedUserIds : [])]),
    doc.organiserCharacterId
      ? Character.findById(doc.organiserCharacterId)
          .select({ name: 1, slug: 1, race: 1, gender: 1, age: 1, title: 1 })
          .lean()
      : Promise.resolve(null),
    doc.placeId
      ? Place.findById(doc.placeId).select({ name: 1, slug: 1, district: 1, summary: 1, region: 1 }).lean()
      : Promise.resolve(null),
    Registration.find({ eventId: doc._id, status: "inscrit" } as never).sort({ createdAt: 1 }).lean(),
    doc.seriesId ? EventSeries.findById(doc.seriesId).lean() : Promise.resolve(null),
  ]);

  const characterIds = registrations.map((registration) => registration.characterId).filter(Boolean);
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
    shareCode: manages ? (doc.shareCode ?? null) : null,
    registeredUserIds: manages ? registrations.map((registration) => registration.userId) : [],
    invited: manages
      ? invitedUserIds
          .map((id) => authors.get(id))
          .filter((invite): invite is NonNullable<typeof invite> => Boolean(invite))
      : [],
    seriesDetail: series ? toSeriesDetail(series as EventSeriesDocument & { _id: unknown }) : null,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

export const getEventBySlug = cache(
  async (slug: string, viewer: SessionUser | null = null): Promise<EventDetail | null> => {
    await connectToDatabase();
    const doc = (await Event.findOne({ slug, hidden: { $ne: true } }).lean()) as EventDoc | null;
    if (!doc) return null;
    return loadEvent(doc, viewer, false);
  },
);

/** La scène qu'ouvre un lien de partage. Le code vaut l'accès : c'est tout ce
 *  que « qui a le lien peut consulter » veut dire. */
export const getEventByShareCode = cache(
  async (shareCode: string, viewer: SessionUser | null = null): Promise<EventDetail | null> => {
    await connectToDatabase();
    const doc = (await Event.findOne({
      shareCode,
      visibility: "privee",
      hidden: { $ne: true },
    }).lean()) as EventDoc | null;
    if (!doc) return null;
    return loadEvent(doc, viewer, true);
  },
);

/** Les séances d'une série, retirées comprises : c'est la page qui les gère.
 *  Les scènes passées y figurent aussi — on y lit ce que la série a tenu. */
export async function listOccurrences(
  seriesId: string,
  viewer: SessionUser | null,
): Promise<EventSummary[]> {
  await connectToDatabase();
  const id = toObjectId(seriesId);
  if (!id) return [];
  // Le même filtre d'accès qu'à l'agenda : une séance à laquelle on n'est plus
  // invité n'a pas à se lire parce qu'on l'était pour sa voisine.
  const docs = (await Event.find({
    $and: [{ seriesId: id, hidden: { $ne: true } }, await accessFilter(viewer, undefined)],
  } as never)
    .sort({ startsAt: 1 })
    .lean()) as EventDoc[];
  return hydrateEvents(docs, viewer?.id ?? null);
}

export async function getSeries(seriesId: string): Promise<EventSeriesDetail | null> {
  await connectToDatabase();
  const id = toObjectId(seriesId);
  if (!id) return null;
  const doc = await EventSeries.findById(id).lean();
  return doc ? toSeriesDetail(doc as EventSeriesDocument & { _id: unknown }) : null;
}

export async function countUpcomingEvents(from: Date, to: Date) {
  await connectToDatabase();
  return Event.countDocuments({ ...PUBLIQUE, startsAt: { $gte: from, $lte: to } } as never);
}

/** Le plan du site : les scènes publiques, et elles seules. Une annonce privée
 *  qui y figurerait donnerait son adresse à tous les moteurs. */
export async function listEventSlugs() {
  await connectToDatabase();
  const docs = await Event.find(PUBLIQUE as never)
    .select({ slug: 1, updatedAt: 1 })
    .lean();
  return docs.map((doc) => ({ slug: doc.slug, updatedAt: toIso(doc.updatedAt) }));
}
