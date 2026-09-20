"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  collectMarkdownImages,
  deleteOrphanedImages,
  deleteUploadedImages,
} from "@/lib/blob";
import { GAME_TIME_ZONE } from "@/lib/dates";
import type { MonthlyMode, Recurrence } from "@/lib/domain";
import { canEditContent, canManageEventGuests, canSeeEvent } from "@/lib/permissions";
import { OCCURRENCES_MAX, OCCURRENCES_PAR_LOT, prochainesSeances } from "@/lib/recurrence";
import type { SessionUser } from "@/lib/session";
import { nouveauCodeDePartage } from "@/lib/share-code";
import { uniqueSlug } from "@/lib/slug";
import { Event, type EventDocument } from "@/models/event";
import { EventSeries } from "@/models/event-series";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import {
  invalidate,
  TAGS,
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { eventSchema } from "@/server/actions/schemas";
import { groupIdsOf } from "@/server/queries/groups";

async function slugTaken(candidate: string) {
  return Boolean(await Event.exists({ slug: candidate }));
}

type EventInput = ReturnType<typeof eventSchema.parse>;

/** Les chemins qu'une écriture d'évènement périme. L'agenda, la carte et
 *  l'accueil listent tous les scènes à venir. */
function refreshEventPaths(slug?: string) {
  invalidate(TAGS.events, TAGS.places, TAGS.groups);
  if (slug) revalidatePath(`/evenements/${slug}`);
  revalidatePath("/evenements");
  revalidatePath("/carte");
  revalidatePath("/groupes");
  revalidatePath("/");
}

/** Le groupe qu'on associe à une scène doit être un groupe qu'on mène.
 *  Sans cette vérification, il suffirait de coller l'identifiant d'un cercle
 *  auquel on n'appartient pas pour y poser une annonce. */
async function ledGroupId(groupId: string | null | undefined, user: SessionUser) {
  const id = objectIdOrNull(groupId ?? null);
  if (!id) return null;
  const group = await Group.findOne({ _id: id, authorId: user.id }).select({ _id: 1 }).lean();
  if (!group) {
    throw new Error("Vous ne pouvez associer une scène qu'à un groupe que vous menez.");
  }
  return id;
}

/** Un évènement qui se tient dans un lieu du registre en hérite la région et le
 *  point ; une scène libre porte le point qu'on a posé sur la carte. */
async function toDocument(data: EventInput, user: SessionUser) {
  const document: Record<string, unknown> = {
    // Les champs sont nommés un à un plutôt que repris en bloc : le schéma
    // porte aussi la règle de la série, qui ne vit pas sur l'évènement.
    title: data.title,
    type: data.type,
    summary: data.summary,
    description: data.description,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    freeLocationLabel: data.freeLocationLabel,
    region: data.region,
    capacity: data.capacity,
    bannerUrl: data.bannerUrl,
    bannerAlt: data.bannerAlt,
    visibility: data.visibility,
    coordinates:
      typeof data.coordinateX === "number" && typeof data.coordinateY === "number"
        ? { x: data.coordinateX, y: data.coordinateY }
        : undefined,
    // Ces identifiants viennent de listes déroulantes : un identifiant tordu
    // est ignoré plutôt que de faire lever une CastError à Mongoose.
    placeId: objectIdOrNull(data.placeId ?? null) ?? undefined,
    organiserCharacterId: objectIdOrNull(data.organiserCharacterId ?? null) ?? undefined,
    practicalNotes: data.practicalNotes
      ? data.practicalNotes.split("\n").map((line) => line.trim()).filter(Boolean)
      : [],
    // Une scène redevenue publique perd ses invités et son groupe : ils ne
    // veulent plus rien dire, et les garder ferait mentir la fiche.
    invitedUserIds: data.visibility === "privee" ? [...new Set(data.invitedUserIds)] : [],
    groupId: data.visibility === "privee" ? await ledGroupId(data.groupId, user) : null,
  };

  if (document.placeId) {
    const place = await Place.findById(document.placeId).select({ region: 1, coordinates: 1 }).lean();
    if (place) {
      document.region = place.region;
      if (typeof place.coordinates?.x === "number") document.coordinates = place.coordinates;
    }
  }

  return document;
}

const JOUR_DE_SEANCE = new Intl.DateTimeFormat("fr-FR", {
  timeZone: GAME_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** L'adresse d'une séance porte sa date : `veillee-au-lion-noir-17-octobre-2026`.
 *  Un suffixe numérique ne dirait pas de quelle séance il s'agit. */
async function slugDeSeance(titre: string, date: Date) {
  return uniqueSlug(`${titre} ${JOUR_DE_SEANCE.format(date)}`, slugTaken);
}

function codeSiPrivee(visibility: unknown) {
  return visibility === "privee" ? nouveauCodeDePartage() : undefined;
}

/** Écrit un lot de séances à partir d'une règle, et renvoie l'adresse de la
 *  première. Chaque séance est une annonce à part entière : son adresse, ses
 *  inscriptions, son lien de partage. */
async function ecrireSeances({
  document,
  data,
  user,
  seriesId,
  ancre,
  apres,
  combien,
  indexDepart,
  pausedAt,
}: {
  document: Record<string, unknown>;
  data: EventInput;
  user: SessionUser;
  seriesId: unknown;
  /** La première séance : c'est elle qui porte la règle. */
  ancre: Date;
  /** La dernière séance écrite : les suivantes reprennent après elle. */
  apres: Date;
  combien: number;
  indexDepart: number;
  pausedAt: Date | null;
}): Promise<{ dates: Date[]; premierSlug: string | null }> {
  const duree =
    data.endsAt instanceof Date ? data.endsAt.getTime() - data.startsAt.getTime() : null;

  const dates = prochainesSeances(
    ancre,
    {
      recurrence: data.recurrence as Exclude<Recurrence, "aucune">,
      monthlyMode: data.monthlyMode as MonthlyMode,
      until: data.seriesUntil instanceof Date ? data.seriesUntil : null,
    },
    combien,
    apres,
  );

  let premierSlug: string | null = null;
  for (const [rang, date] of dates.entries()) {
    const slug = await slugDeSeance(data.title, date);
    if (!premierSlug) premierSlug = slug;
    await Event.create({
      ...document,
      slug,
      authorId: user.id,
      startsAt: date,
      endsAt: duree === null ? undefined : new Date(date.getTime() + duree),
      shareCode: codeSiPrivee(document.visibility),
      seriesId: seriesId as never,
      occurrenceIndex: indexDepart + rang,
      seriesPausedAt: pausedAt ?? undefined,
    });
  }

  return { dates, premierSlug };
}

/** Le nombre de séances promis, ou `null` quand la série n'en promet pas.
 *  Il est écrit sur la série : c'est lui qui fait disparaître « prolonger »
 *  quand le compte est atteint. */
function plafondPromis(data: EventInput): number | null {
  if (data.seriesEnd !== "compte" || typeof data.seriesCount !== "number") return null;
  return Math.min(data.seriesCount, OCCURRENCES_MAX);
}

/** Combien de séances s'écrivent d'un coup. Toujours un lot, promesse ou non :
 *  écrire soixante annonces dans une seule action tiendrait la personne devant
 *  un formulaire qui n'en finit pas. Le reste s'écrit en prolongeant. */
function tailleDuLot(plafond: number | null): number {
  return Math.min(OCCURRENCES_PAR_LOT, plafond ?? OCCURRENCES_PAR_LOT);
}

export async function createEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const parsed = parseForm(eventSchema, formData);
    if (!parsed.ok) return parsed.state;
    const data = parsed.data;

    const document = await toDocument(data, user);
    slug = await uniqueSlug(data.title, slugTaken);

    if (data.recurrence === "aucune") {
      await Event.create({
        ...document,
        slug,
        authorId: user.id,
        shareCode: codeSiPrivee(document.visibility),
      });
    } else {
      const until = data.seriesEnd === "date" && data.seriesUntil instanceof Date ? data.seriesUntil : null;
      const plafond = plafondPromis(data);
      const series = await EventSeries.create({
        recurrence: data.recurrence,
        monthlyMode: data.monthlyMode,
        anchorAt: data.startsAt,
        until: until ?? undefined,
        maxOccurrences: plafond ?? undefined,
        lastOccurrenceAt: data.startsAt,
        occurrenceCount: 1,
        authorId: user.id,
      });

      // La première séance porte la date saisie ; les suivantes en découlent.
      slug = await slugDeSeance(data.title, data.startsAt);
      await Event.create({
        ...document,
        slug,
        authorId: user.id,
        shareCode: codeSiPrivee(document.visibility),
        seriesId: series._id,
        occurrenceIndex: 1,
      });

      const { dates } = await ecrireSeances({
        document,
        data: { ...data, seriesUntil: until },
        user,
        seriesId: series._id,
        ancre: data.startsAt,
        apres: data.startsAt,
        combien: tailleDuLot(plafond) - 1,
        indexDepart: 2,
        pausedAt: null,
      });

      if (dates.length > 0) {
        series.lastOccurrenceAt = dates[dates.length - 1];
        series.occurrenceCount = 1 + dates.length;
        await series.save();
      }
    }
  } catch (error) {
    return toActionState(error);
  }

  refreshEventPaths();
  redirect(`/evenements/${slug}`);
}

export async function updateEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Event.findById(id) : null;
    if (!existing) return errorState("Cet évènement n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Cet évènement appartient à quelqu'un d'autre.");
    }

    const parsed = parseForm(eventSchema, formData);
    if (!parsed.ok) return parsed.state;

    // Remplacer ou retirer une image abandonne l'ancienne dans le stockage,
    // exactement comme une suppression de fiche. La description en porte
    // désormais elle aussi : celles qu'on vient d'en retirer s'en vont avec.
    const previousImages = [
      existing.bannerUrl,
      ...collectMarkdownImages(existing.description),
    ];

    const document = await toDocument(parsed.data, user);
    existing.set(document);

    // Le code suit la visibilité : une scène qui s'ouvre perd le sien — son
    // ancien lien ne doit pas rouvrir la porte si elle redevient privée — et
    // une scène qui se ferme en reçoit un.
    if (document.visibility === "privee") {
      if (!existing.shareCode) existing.shareCode = nouveauCodeDePartage();
    } else if (existing.shareCode) {
      existing.set("shareCode", undefined);
      existing.markModified("shareCode");
    }

    await existing.save();
    // Un code retiré doit disparaître du document : mis à `null`, il se
    // heurterait au code `null` de la scène publique d'à côté.
    if (document.visibility !== "privee") {
      await Event.updateOne({ _id: existing._id }, { $unset: { shareCode: "" } });
    }
    slug = existing.slug;

    await deleteOrphanedImages(
      previousImages,
      [existing.bannerUrl, ...collectMarkdownImages(existing.description)],
      existing.authorId,
    );
  } catch (error) {
    return toActionState(error);
  }

  refreshEventPaths(slug);
  redirect(`/evenements/${slug}`);
}

export async function deleteEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Event.findById(id) : null;
    if (!existing) return errorState("Cet évènement n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Cet évènement appartient à quelqu'un d'autre.");
    }
    const images = [existing.bannerUrl, ...collectMarkdownImages(existing.description)];
    const seriesId = existing.seriesId;
    await Promise.all([Registration.deleteMany({ eventId: existing._id }), existing.deleteOne()]);
    await deleteUploadedImages(images, existing.authorId);

    // Une série sans séance n'est plus une série : sa règle ne s'applique
    // à rien, et sa page n'aurait plus rien à montrer.
    if (seriesId && !(await Event.exists({ seriesId }))) {
      await EventSeries.deleteOne({ _id: seriesId });
    }
  } catch (error) {
    return toActionState(error);
  }

  refreshEventPaths();
  redirect("/evenements");
}

/** Le code de partage, refait. L'ancien lien cesse d'ouvrir l'annonce ; les
 *  inscriptions déjà prises restent — elles valent accès à elles seules. */
export async function regenerateShareCodeAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("eventId"));
    const event = id ? await Event.findById(id) : null;
    if (!event) return errorState("Cet évènement n'existe plus.");
    if (!canManageEventGuests(user, event.authorId)) {
      return errorState("Seul l'organisateur change le code de partage.");
    }
    if (event.visibility !== "privee") {
      return errorState("Une scène publique n'a pas de lien de partage.");
    }

    event.shareCode = nouveauCodeDePartage();
    await event.save();
    refreshEventPaths(event.slug);
    return successState("Le code est changé. L'ancien lien n'ouvre plus l'annonce.");
  } catch (error) {
    return toActionState(error);
  }
}

/** Inviter un compte par son pseudo, ou le retirer. La liste reste à
 *  l'organisateur : un invité n'invite pas à son tour. */
export async function inviteToEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("eventId"));
    const guestId = objectIdOrNull(formData.get("userId"));
    const retirer = formData.get("retirer") === "1";

    const event = id ? await Event.findById(id) : null;
    if (!event) return errorState("Cet évènement n'existe plus.");
    if (!canManageEventGuests(user, event.authorId)) {
      return errorState("Seul l'organisateur invite à cette scène.");
    }
    if (!guestId) return errorState("Ce compte n'existe pas.");

    const invites = new Set(event.invitedUserIds ?? []);
    if (retirer) invites.delete(guestId);
    else if (invites.size >= 30) return errorState("Une scène ne s'ouvre pas à plus de trente invités.");
    else invites.add(guestId);

    event.invitedUserIds = [...invites];
    await event.save();

    refreshEventPaths(event.slug);
    return successState(retirer ? "L'invitation est retirée." : "L'invitation est envoyée.");
  } catch (error) {
    return toActionState(error);
  }
}

/** Retirer une séance d'une série, ou la rétablir.
 *
 *  Une séance retirée quitte l'agenda et la carte sans perdre ses inscrits :
 *  c'est ce qui permet de la rétablir. Supprimer la séance, c'est autre chose,
 *  et ça passe par la suppression de l'annonce. */
export async function toggleOccurrenceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("eventId"));
    const retablir = formData.get("retablir") === "1";
    const suivantes = formData.get("suivantes") === "on";

    const event = id ? await Event.findById(id) : null;
    if (!event) return errorState("Cette séance n'existe plus.");
    if (!canEditContent(user, event.authorId)) {
      return errorState("Cette série appartient à quelqu'un d'autre.");
    }

    const cible = retablir ? null : new Date();
    const filtre =
      suivantes && event.seriesId
        ? { seriesId: event.seriesId, startsAt: { $gte: event.startsAt } }
        : { _id: event._id };

    await Event.updateMany(
      filtre as never,
      cible ? { $set: { cancelledAt: cible } } : { $unset: { cancelledAt: "" } },
    );

    refreshEventPaths(event.slug);
    return successState(
      retablir
        ? "La séance est rétablie, avec ses inscrits."
        : suivantes
          ? "Ces séances quittent l'agenda."
          : "La séance quitte l'agenda. Vous pourrez la rétablir.",
    );
  } catch (error) {
    return toActionState(error);
  }
}

/** Mettre une série en pause, ou la reprendre.
 *
 *  La pause se recopie sur chaque séance : l'agenda filtre alors en une passe,
 *  sans avoir à charger la série de chaque scène qu'il rencontre. */
export async function toggleSeriesPauseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("seriesId"));
    const series = id ? await EventSeries.findById(id) : null;
    if (!series) return errorState("Cette série n'existe plus.");
    if (!canEditContent(user, series.authorId)) {
      return errorState("Cette série appartient à quelqu'un d'autre.");
    }

    const enPause = Boolean(series.pausedAt);
    const maintenant = new Date();
    if (enPause) {
      series.set("pausedAt", undefined);
      await series.save();
      await EventSeries.updateOne({ _id: series._id }, { $unset: { pausedAt: "" } });
      await Event.updateMany({ seriesId: series._id } as never, { $unset: { seriesPausedAt: "" } });
    } else {
      series.pausedAt = maintenant;
      await series.save();
      await Event.updateMany(
        { seriesId: series._id } as never,
        { $set: { seriesPausedAt: maintenant } },
      );
    }

    refreshEventPaths();
    return successState(
      enPause
        ? "La série reprend : ses séances reviennent à l'agenda, avec leurs inscrits."
        : "La série est en pause : ses séances quittent l'agenda jusqu'à la reprise.",
    );
  } catch (error) {
    return toActionState(error);
  }
}

/** Prolonger une série sans fin d'un lot de séances. C'est explicite : rien
 *  ne s'écrit dans le dos de l'organisateur pendant qu'il lit sa page. */
export async function extendSeriesAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("seriesId"));
    const series = id ? await EventSeries.findById(id) : null;
    if (!series) return errorState("Cette série n'existe plus.");
    if (!canEditContent(user, series.authorId)) {
      return errorState("Cette série appartient à quelqu'un d'autre.");
    }
    if (series.until) return errorState("Cette série a une fin : elle ne se prolonge pas.");

    const ecrites = series.occurrenceCount ?? 0;
    const plafond = series.maxOccurrences ?? OCCURRENCES_MAX;
    const reste = plafond - ecrites;
    if (reste <= 0) {
      return errorState(
        series.maxOccurrences
          ? `Cette série en promettait ${series.maxOccurrences} : elle les a toutes. Annoncez-en une nouvelle.`
          : `Une série ne dépasse pas ${OCCURRENCES_MAX} séances. Annoncez-en une nouvelle.`,
      );
    }

    // La dernière séance écrite sert de modèle : son contenu, son lieu, sa
    // visibilité. C'est la plus proche de ce que l'organisateur vient de relire.
    const modele = await Event.findOne({ seriesId: series._id })
      .sort({ occurrenceIndex: -1 })
      .lean();
    if (!modele) return errorState("Cette série n'a plus de séance à recopier.");

    const document = modeleDeSeance(modele as EventDocument);
    const { dates } = await ecrireSeances({
      document,
      data: {
        title: modele.title,
        startsAt: new Date(series.anchorAt),
        endsAt: modele.endsAt
          ? new Date(
              new Date(series.anchorAt).getTime() +
                (new Date(modele.endsAt).getTime() - new Date(modele.startsAt).getTime()),
            )
          : null,
        recurrence: series.recurrence as Recurrence,
        monthlyMode: (series.monthlyMode ?? "quantieme") as MonthlyMode,
        seriesUntil: null,
      } as EventInput,
      user,
      seriesId: series._id,
      // La règle se relit sur la première séance, jamais sur la dernière
      // écrite : sinon « le dernier samedi » deviendrait « le quatrième ».
      ancre: new Date(series.anchorAt),
      apres: new Date(series.lastOccurrenceAt),
      combien: Math.min(OCCURRENCES_PAR_LOT, reste),
      indexDepart: ecrites + 1,
      pausedAt: series.pausedAt ? new Date(series.pausedAt) : null,
    });

    if (dates.length === 0) return errorState("La règle ne produit plus de séance.");

    series.lastOccurrenceAt = dates[dates.length - 1];
    series.occurrenceCount = ecrites + dates.length;
    await series.save();

    refreshEventPaths();
    return successState(
      `${dates.length} séance${dates.length > 1 ? "s" : ""} de plus, jusqu'au ${JOUR_DE_SEANCE.format(
        dates[dates.length - 1],
      )}.`,
    );
  } catch (error) {
    return toActionState(error);
  }
}

/** Ce qu'une séance recopie de sa voisine : tout sauf ce qui lui est propre —
 *  sa date, son adresse, son code de partage et son rang. */
function modeleDeSeance(doc: EventDocument): Record<string, unknown> {
  return {
    title: doc.title,
    type: doc.type,
    summary: doc.summary,
    description: doc.description,
    practicalNotes: doc.practicalNotes,
    placeId: doc.placeId,
    freeLocationLabel: doc.freeLocationLabel,
    region: doc.region,
    coordinates: doc.coordinates,
    capacity: doc.capacity,
    bannerUrl: doc.bannerUrl,
    bannerAlt: doc.bannerAlt,
    organiserCharacterId: doc.organiserCharacterId,
    visibility: doc.visibility,
    invitedUserIds: doc.invitedUserIds,
    groupId: doc.groupId,
  };
}

/** Qui peut s'inscrire : qui peut voir. Une scène privée ne se rejoint pas en
 *  postant son identifiant — c'est la même règle qu'à la lecture, appliquée au
 *  même endroit qu'elle. */
async function assertCanJoin(user: SessionUser, event: EventDocument & { _id: unknown }, shareCode: string | null) {
  const visible = canSeeEvent(
    user,
    {
      visibility: (event.visibility ?? "publique") as "publique" | "privee",
      authorId: event.authorId,
      invitedUserIds: event.invitedUserIds ?? [],
      groupId: event.groupId ? String(event.groupId) : null,
    },
    {
      groupIds: await groupIdsOf(user.id),
      withShareCode: Boolean(shareCode && event.shareCode && shareCode === event.shareCode),
    },
  );
  if (!visible) throw new Error("Cette scène ne vous est pas ouverte.");
}

/** S'inscrire. Au-delà de la capacité, la place part en liste d'attente —
 *  on le dit à l'écran plutôt que de griser le bouton. */
export async function registerToEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const eventId = objectIdOrNull(formData.get("eventId"));
    const characterId = objectIdOrNull(formData.get("characterId")) ?? undefined;
    const shareCode = typeof formData.get("code") === "string" ? String(formData.get("code")) : null;

    const event = eventId ? await Event.findById(eventId) : null;
    if (!event) return errorState("Cet évènement n'existe plus.");
    if (event.cancelledAt) return errorState("Cette séance a été retirée de l'agenda.");
    if (event.seriesPausedAt) {
      return errorState("Cette série est en pause : ses séances ne se tiennent pas.");
    }
    await assertCanJoin(user, event, shareCode);

    const existing = await Registration.findOne({ eventId: event._id, userId: user.id });
    if (existing) return errorState("Vous êtes déjà inscrit à cet évènement.");

    const taken = await Registration.countDocuments({ eventId: event._id, status: "inscrit" });
    const status =
      typeof event.capacity === "number" && event.capacity > 0 && taken >= event.capacity
        ? "liste-attente"
        : "inscrit";

    await Registration.create({ eventId: event._id, userId: user.id, characterId, status });

    refreshEventPaths(event.slug);

    return successState(
      status === "inscrit"
        ? "Vous êtes inscrit. Vous pourrez annuler jusqu'à l'heure du rendez-vous."
        : "L'évènement est complet : vous êtes sur la liste d'attente.",
    );
  } catch (error) {
    return toActionState(error);
  }
}

/** Se désinscrire. La première place de la liste d'attente est reprise. */
export async function unregisterFromEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const eventId = objectIdOrNull(formData.get("eventId"));

    const event = eventId ? await Event.findById(eventId) : null;
    if (!event) return errorState("Cet évènement n'existe plus.");

    const registration = await Registration.findOne({ eventId: event._id, userId: user.id });
    if (!registration) return errorState("Vous n'étiez pas inscrit à cet évènement.");

    const wasRegistered = registration.status === "inscrit";
    await registration.deleteOne();

    if (wasRegistered) {
      const next = await Registration.findOne({
        eventId: event._id,
        status: "liste-attente",
      }).sort({ createdAt: 1 });
      if (next) {
        next.status = "inscrit";
        await next.save();
      }
    }

    refreshEventPaths(event.slug);

    return successState("Votre inscription est annulée.");
  } catch (error) {
    return toActionState(error);
  }
}
