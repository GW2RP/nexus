"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteUploadedImages } from "@/lib/blob";
import { canEditContent } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { Event } from "@/models/event";
import { Place } from "@/models/place";
import { Registration } from "@/models/registration";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { eventSchema } from "@/server/actions/schemas";

async function slugTaken(candidate: string) {
  return Boolean(await Event.exists({ slug: candidate }));
}

type EventInput = ReturnType<typeof eventSchema.parse>;

/** Un évènement qui se tient dans un lieu du registre en hérite la région et le point. */
async function toDocument(data: EventInput) {
  const { practicalNotes, placeId, organiserCharacterId, ...rest } = data;
  const document: Record<string, unknown> = {
    ...rest,
    // Ces identifiants viennent de listes déroulantes : un identifiant tordu
    // est ignoré plutôt que de faire lever une CastError à Mongoose.
    placeId: objectIdOrNull(placeId ?? null) ?? undefined,
    organiserCharacterId: objectIdOrNull(organiserCharacterId ?? null) ?? undefined,
    practicalNotes: practicalNotes
      ? practicalNotes.split("\n").map((line) => line.trim()).filter(Boolean)
      : [],
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

export async function createEventAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const parsed = parseForm(eventSchema, formData);
    if (!parsed.ok) return parsed.state;

    slug = await uniqueSlug(parsed.data.title, slugTaken);
    await Event.create({ ...(await toDocument(parsed.data)), slug, authorId: user.id });
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/evenements");
  revalidatePath("/carte");
  revalidatePath("/");
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
    // exactement comme une suppression de fiche.
    const previousBanner = existing.bannerUrl;

    existing.set(await toDocument(parsed.data));
    await existing.save();
    slug = existing.slug;

    if (previousBanner && previousBanner !== existing.bannerUrl) {
      await deleteUploadedImages([previousBanner]);
    }
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath(`/evenements/${slug}`);
  revalidatePath("/evenements");
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
    const banner = existing.bannerUrl;
    await Promise.all([Registration.deleteMany({ eventId: existing._id }), existing.deleteOne()]);
    await deleteUploadedImages([banner]);
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/evenements");
  revalidatePath("/carte");
  redirect("/evenements");
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

    const event = eventId ? await Event.findById(eventId) : null;
    if (!event) return errorState("Cet évènement n'existe plus.");

    const existing = await Registration.findOne({ eventId: event._id, userId: user.id });
    if (existing) return errorState("Vous êtes déjà inscrit à cet évènement.");

    const taken = await Registration.countDocuments({ eventId: event._id, status: "inscrit" });
    const status =
      typeof event.capacity === "number" && event.capacity > 0 && taken >= event.capacity
        ? "liste-attente"
        : "inscrit";

    await Registration.create({ eventId: event._id, userId: user.id, characterId, status });

    revalidatePath(`/evenements/${event.slug}`);
    revalidatePath("/evenements");
    revalidatePath("/");

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

    revalidatePath(`/evenements/${event.slug}`);
    revalidatePath("/evenements");
    revalidatePath("/");

    return successState("Votre inscription est annulée.");
  } catch (error) {
    return toActionState(error);
  }
}
