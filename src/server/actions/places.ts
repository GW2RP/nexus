"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  collectMarkdownImages,
  deleteOrphanedImages,
  deleteUploadedImages,
} from "@/lib/blob";
import { canEditContent, canEditPlace, canManagePlaceTeam } from "@/lib/permissions";
import { uniqueSlug } from "@/lib/slug";
import { Character } from "@/models/character";
import { Place } from "@/models/place";
import { User } from "@/models/user";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { placeSchema } from "@/server/actions/schemas";
import { listCharactersOfMany } from "@/server/queries/characters";
import { toObjectId } from "@/server/queries/shared";

async function slugTaken(candidate: string) {
  return Boolean(await Place.exists({ slug: candidate }));
}

/** Les comptes proposés comme co-gérants doivent exister, et l'auteur n'est pas
 *  son propre co-gérant : il tient déjà le lieu. Un identifiant inventé est
 *  écarté plutôt que refusé — rien de ce qu'on peut taper ici ne doit bloquer
 *  l'enregistrement du reste de la fiche. */
async function keepKnownAccounts(ids: string[], authorId: string): Promise<string[]> {
  const wanted = [...new Set(ids)].filter((id) => id !== authorId);
  const objectIds = wanted.map(toObjectId).filter((id) => id !== null);
  if (objectIds.length === 0) return [];

  const found = await User.find({ _id: { $in: objectIds } })
    .select({ _id: 1 })
    .lean();
  const known = new Set(found.map((user) => String(user._id)));
  return wanted.filter((id) => known.has(id));
}

/** Un lieu n'est tenu que par les personnages de ceux qui le gèrent : sans cette
 *  vérification, il suffirait de poster l'identifiant du personnage d'un autre
 *  pour l'installer derrière son comptoir. */
async function keepManagedCharacters(ids: string[], ownerIds: string[]): Promise<string[]> {
  const wanted = [...new Set(ids)];
  const objectIds = wanted.map(objectIdOrNull).filter((id) => id !== null);
  if (objectIds.length === 0) return [];

  const found = await Character.find({ _id: { $in: objectIds }, authorId: { $in: ownerIds } })
    .select({ _id: 1 })
    .lean();
  const known = new Set(found.map((character) => String(character._id)));
  return wanted.filter((id) => known.has(id));
}

/** Les coordonnées se saisissent en deux champs ; le modèle les range ensemble. */
function toDocument(
  data: ReturnType<typeof placeSchema.parse>,
  team: { managerIds: string[]; keeperCharacterIds: string[] },
): Record<string, unknown> {
  const { coordinateX, coordinateY, ...rest } = data;
  return {
    ...rest,
    // Les deux listes du formulaire sont remplacées par celles que le serveur a
    // vérifiées : un identifiant posté à la main n'entre pas dans le document.
    managerIds: team.managerIds,
    keeperCharacterIds: team.keeperCharacterIds,
    coordinates:
      typeof coordinateX === "number" && typeof coordinateY === "number"
        ? { x: coordinateX, y: coordinateY }
        : undefined,
  };
}

/** Qui, au moment de l'enregistrement, peut prêter un personnage au comptoir :
 *  l'auteur et les co-gérants tels que ce formulaire les laisse. */
async function resolveTeam(
  data: ReturnType<typeof placeSchema.parse>,
  context: { authorId: string; currentManagerIds: string[]; canChangeTeam: boolean },
) {
  const managerIds = context.canChangeTeam
    ? await keepKnownAccounts(data.managerIds, context.authorId)
    : // Un co-gérant modifie la fiche, pas la liste de ceux qui la modifient.
      context.currentManagerIds;

  return {
    managerIds,
    keeperCharacterIds: await keepManagedCharacters(data.keeperCharacterIds, [
      context.authorId,
      ...managerIds,
    ]),
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

    const team = await resolveTeam(parsed.data, {
      authorId: user.id,
      currentManagerIds: [],
      canChangeTeam: true,
    });

    slug = await uniqueSlug(parsed.data.name, slugTaken);
    await Place.create({
      ...toDocument(parsed.data, team),
      slug,
      authorId: user.id,
    } as never);
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

    const currentManagerIds = existing.managerIds ?? [];
    if (!canEditPlace(user, { authorId: existing.authorId, managerIds: currentManagerIds })) {
      return errorState("Ce lieu appartient à quelqu'un d'autre.");
    }

    const parsed = parseForm(placeSchema, formData);
    if (!parsed.ok) return parsed.state;

    const team = await resolveTeam(parsed.data, {
      authorId: existing.authorId,
      currentManagerIds,
      canChangeTeam: canManagePlaceTeam(user, { authorId: existing.authorId }),
    });

    // Remplacer ou retirer une image abandonne l'ancienne dans le stockage,
    // exactement comme une suppression de fiche. La description porte elle
    // aussi des images : celles qu'on vient d'en retirer s'en vont avec.
    const previousImages = [
      existing.bannerUrl,
      ...collectMarkdownImages(existing.description),
    ];

    existing.set(toDocument(parsed.data, team));
    // La liste remplace le champ au singulier d'avant : le laisser en place
    // ferait revenir un tenancier qu'on vient de retirer, puisque la lecture s'y
    // rabat quand la liste est vide.
    existing.set("keeperCharacterId", undefined);
    await existing.save();
    slug = existing.slug;

    await deleteOrphanedImages(
      previousImages,
      [existing.bannerUrl, ...collectMarkdownImages(existing.description)],
      existing.authorId,
    );
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
    // Un co-gérant modifie le lieu ; le retirer du registre reste à son auteur.
    if (!canEditContent(user, existing.authorId)) {
      return errorState("Ce lieu appartient à quelqu'un d'autre.");
    }

    const images = [
      existing.bannerUrl,
      existing.logoUrl,
      existing.floorPlan?.imageUrl,
      ...collectMarkdownImages(existing.description),
    ];
    await existing.deleteOne();
    await deleteUploadedImages(images, existing.authorId);
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/lieux");
  revalidatePath("/carte");
  redirect("/lieux");
}

/** Les comptes qu'on peut nommer co-gérants, cherchés par leur pseudo.
 *
 *  Le formulaire est un composant client : il ne peut pas lire la base
 *  directement. Seuls le pseudo et l'identifiant sortent d'ici — le courriel
 *  d'un membre ne regarde personne. */
export async function searchAccountsAction(
  query: string,
): Promise<{ id: string; name: string }[]> {
  await requireContributor();
  const terme = query.trim();
  if (terme.length < 2) return [];

  const escaped = terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({ name: new RegExp(escaped, "i") })
    .select({ name: 1 })
    .sort({ name: 1 })
    .limit(8)
    .lean();

  return users.map((found) => ({ id: String(found._id), name: found.name }));
}

/** Les personnages que ces comptes tiennent : le choix proposé pour « tenu par ».
 *  Le formulaire le redemande dès qu'un co-gérant entre ou sort. */
export async function listKeeperOptionsAction(
  ownerIds: string[],
): Promise<{ id: string; name: string; authorId: string }[]> {
  await requireContributor();
  // Neuf comptes au plus : l'auteur et les huit co-gérants que le schéma admet.
  return listCharactersOfMany(ownerIds.slice(0, 9));
}
