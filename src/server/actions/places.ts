"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { deleteUploadedImages } from "@/lib/blob";
import { canEditContent } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { Place } from "@/models/place";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { placeSchema } from "@/server/actions/schemas";

async function slugTaken(candidate: string) {
  return Boolean(await Place.exists({ slug: candidate }));
}

/** Les coordonnées se saisissent en deux champs ; le modèle les range ensemble. */
function toDocument(data: ReturnType<typeof placeSchema.parse>): Record<string, unknown> {
  const { coordinateX, coordinateY, keeperCharacterId, ...rest } = data;
  return {
    ...rest,
    keeperCharacterId: objectIdOrNull(keeperCharacterId ?? null) ?? undefined,
    coordinates:
      typeof coordinateX === "number" && typeof coordinateY === "number"
        ? { x: coordinateX, y: coordinateY }
        : undefined,
  };
}

export async function createPlaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const parsed = parseForm(placeSchema, formData);
    if (!parsed.ok) return parsed.state;

    slug = await uniqueSlug(parsed.data.name, slugTaken);
    await Place.create({ ...toDocument(parsed.data), slug, authorId: user.id } as never);
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/lieux");
  revalidatePath("/carte");
  redirect(`/lieux/${slug}`);
}

export async function updatePlaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Place.findById(id) : null;
    if (!existing) return errorState("Ce lieu n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Ce lieu appartient à quelqu'un d'autre.");
    }

    const parsed = parseForm(placeSchema, formData);
    if (!parsed.ok) return parsed.state;

    // Remplacer ou retirer une image abandonne l'ancienne dans le stockage,
    // exactement comme une suppression de fiche.
    const previousBanner = existing.bannerUrl;

    existing.set(toDocument(parsed.data));
    await existing.save();
    slug = existing.slug;

    if (previousBanner && previousBanner !== existing.bannerUrl) {
      await deleteUploadedImages([previousBanner], existing.authorId);
    }
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath(`/lieux/${slug}`);
  revalidatePath("/lieux");
  revalidatePath("/carte");
  redirect(`/lieux/${slug}`);
}

export async function deletePlaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Place.findById(id) : null;
    if (!existing) return errorState("Ce lieu n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Ce lieu appartient à quelqu'un d'autre.");
    }

    const images = [existing.bannerUrl, existing.logoUrl, existing.floorPlan?.imageUrl];
    await existing.deleteOne();
    await deleteUploadedImages(images, existing.authorId);
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/lieux");
  revalidatePath("/carte");
  redirect("/lieux");
}
