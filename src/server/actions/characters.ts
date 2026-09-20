"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  collectMarkdownImages,
  deleteOrphanedImages,
  deleteUploadedImages,
} from "@/lib/blob";
import { canEditContent } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { Character } from "@/models/character";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { characterSchema } from "@/server/actions/schemas";

async function slugTaken(candidate: string) {
  return Boolean(await Character.exists({ slug: candidate }));
}

export async function createCharacterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const parsed = parseForm(characterSchema, formData);
    if (!parsed.ok) return parsed.state;

    slug = await uniqueSlug(parsed.data.name, slugTaken);
    await Character.create({ ...parsed.data, slug, authorId: user.id });
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/personnages");
  revalidatePath("/");
  redirect(`/personnages/${slug}`);
}

export async function updateCharacterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let slug: string;
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Character.findById(id) : null;
    if (!existing) return errorState("Cette fiche n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Cette fiche appartient à quelqu'un d'autre.");
    }

    const parsed = parseForm(characterSchema, formData);
    if (!parsed.ok) return parsed.state;

    // Remplacer ou retirer une image abandonne l'ancienne dans le stockage,
    // exactement comme une suppression de fiche. L'histoire et l'allure portent
    // elles aussi des images : celles qu'on vient d'en retirer s'en vont avec.
    const previousImages = [
      existing.portraitUrl,
      ...collectMarkdownImages(existing.story, existing.appearance),
    ];

    existing.set(parsed.data);
    await existing.save();
    slug = existing.slug;

    await deleteOrphanedImages(
      previousImages,
      [existing.portraitUrl, ...collectMarkdownImages(existing.story, existing.appearance)],
      existing.authorId,
    );
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath(`/personnages/${slug}`);
  revalidatePath("/personnages");
  redirect(`/personnages/${slug}`);
}

export async function deleteCharacterAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await Character.findById(id) : null;
    if (!existing) return errorState("Cette fiche n'existe plus.");
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Cette fiche appartient à quelqu'un d'autre.");
    }

    const images = [
      existing.portraitUrl,
      ...collectMarkdownImages(existing.story, existing.appearance),
    ];
    await existing.deleteOne();
    // Les images vivent dans le stockage, pas dans la base : elles resteraient servies.
    await deleteUploadedImages(images, existing.authorId);
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/personnages");
  redirect("/personnages");
}
