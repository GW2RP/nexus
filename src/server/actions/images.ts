"use server";

import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { isAdmin } from "@/lib/permissions";
import { UploadedImage } from "@/models/uploaded-image";
import {
  errorState,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { findImageUses, listImagesOf } from "@/server/images";

/** Le jeton qui demande toutes les orphelines d'un coup, à la place d'une adresse. */
const TOUTES_LES_ORPHELINES = "orphelines";

/** Supprimer des images d'un inventaire : une seule, ou toutes les orphelines.
 *
 *  Seule une image qui ne sert plus nulle part se supprime. Une image encore
 *  portée par une fiche se retire de la fiche, qui l'emporte alors au magasin :
 *  l'effacer d'ici laisserait la fiche montrer un cadre vide. L'inventaire se
 *  relit au moment du geste, pas sur la foi de la page affichée.
 *
 *  `ownerId` est le compte dont on lit l'inventaire : le sien, ou n'importe
 *  lequel pour l'administration. */
export async function deleteImagesAction(
  ownerId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    if (ownerId !== user.id && !isAdmin(user)) {
      return errorState("Ces images ne sont pas les vôtres.");
    }

    const target = String(formData.get("id") ?? "");
    const entries = await listImagesOf(ownerId);
    const candidates =
      target === TOUTES_LES_ORPHELINES
        ? entries
        : entries.filter((entry) => entry.url === target);
    if (candidates.length === 0) return errorState("Cette image n'est plus là.");

    const uses = await findImageUses(candidates);
    const orphans = candidates.filter((entry) => (uses.get(entry.url) ?? []).length === 0);
    if (orphans.length === 0) {
      return errorState(
        target === TOUTES_LES_ORPHELINES
          ? "Aucune image orpheline à supprimer."
          : "Cette image sert encore : retirez-la d'abord du contenu qui la montre.",
      );
    }

    try {
      await del(orphans.map((entry) => entry.url));
    } catch (error) {
      console.error("Images non supprimées du stockage :", error);
      return errorState("Le stockage n'a pas répondu. Réessayez dans un moment.");
    }
    await UploadedImage.deleteMany({
      pathname: { $in: orphans.map((entry) => entry.pathname) },
    } as never);

    revalidatePath("/mon-compte");
    revalidatePath("/mon-compte/images");
    revalidatePath(`/admin/utilisateurs/${ownerId}/images`);
    return successState(
      orphans.length > 1 ? `${orphans.length} images sont supprimées.` : "L'image est supprimée.",
    );
  } catch (error) {
    return toActionState(error);
  }
}
