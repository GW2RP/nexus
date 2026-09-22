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
import { Board } from "@/models/board";
import { Character } from "@/models/character";
import { Place } from "@/models/place";
import { User } from "@/models/user";
import {
  invalidate,
  TAGS,
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

/** Les images que les plans d'une fiche portent, l'ancien champ au singulier
 *  compris : elles vivent dans le magasin, et le ménage les suit comme la
 *  bannière. */
function planImages(place: {
  floorPlan?: { imageUrl?: string | null } | null;
  floorPlans?: { imageUrl?: string | null }[] | null;
}): (string | null | undefined)[] {
  return [place.floorPlan?.imageUrl, ...(place.floorPlans ?? []).map((plan) => plan.imageUrl)];
}

/** Les plans à écrire.
 *
 *  Les points sont numérotés par leur rang dans la liste, au serveur : le
 *  formulaire ne poste que leur ordre, et deux points ne peuvent donc pas porter
 *  le même numéro — ni un trou s'ouvrir quand on en retire un.
 *
 *  Un plan qui ne porte ni image ni point n'est pas écrit : la lecture l'ignore
 *  déjà — il n'a rien à montrer —, et l'écrire quand même laisserait en base un
 *  plan que ni la fiche ni le formulaire ne rendent, donc que personne ne peut
 *  plus retirer. L'écriture et la lecture s'accordent plutôt que de diverger. */
function toFloorPlans(plans: ReturnType<typeof placeSchema.parse>["floorPlans"]) {
  return plans
    .filter((plan) => Boolean(plan.imageUrl) || plan.points.length > 0)
    .map((plan) => ({
      ...plan,
      points: plan.points.map((point, index) => ({ ...point, number: index + 1 })),
    }));
}

/** Les coordonnées se saisissent en deux champs ; le modèle les range ensemble. */
function toDocument(
  data: ReturnType<typeof placeSchema.parse>,
  team: { managerIds: string[]; keeperCharacterIds: string[] },
): Record<string, unknown> {
  const { coordinateX, coordinateY, floorPlans, ...rest } = data;
  return {
    ...rest,
    floorPlans: toFloorPlans(floorPlans),
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

  invalidate(TAGS.places);
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
      ...planImages(existing),
      ...collectMarkdownImages(existing.description),
    ];

    existing.set(toDocument(parsed.data, team));
    // La liste remplace le champ au singulier d'avant : le laisser en place
    // ferait revenir un tenancier qu'on vient de retirer, puisque la lecture s'y
    // rabat quand la liste est vide.
    existing.set("keeperCharacterId", undefined);
    // Même chose pour le plan d'avant la liste : il vient d'y entrer, et le
    // laisser en place le ferait revenir en double — la lecture s'y rabat quand
    // la liste est vide.
    existing.set("floorPlan", undefined);
    await existing.save();
    slug = existing.slug;

    await deleteOrphanedImages(
      previousImages,
      [
        existing.bannerUrl,
        ...planImages(existing),
        ...collectMarkdownImages(existing.description),
      ],
      existing.authorId,
    );
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath(`/lieux/${slug}`);
  invalidate(TAGS.places);
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
      ...planImages(existing),
      ...collectMarkdownImages(existing.description),
    ];
    // Le panneau d'affichage n'existe que par le lieu : il part avec.
    await Board.deleteMany({ placeId: existing._id } as never);
    await existing.deleteOne();
    await deleteUploadedImages(images, existing.authorId);
  } catch (error) {
    return toActionState(error);
  }

  invalidate(TAGS.places);
  revalidatePath("/lieux");
  revalidatePath("/carte");
  redirect("/lieux");
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
