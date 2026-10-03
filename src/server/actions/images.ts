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

/** Supprimer des images d'un inventaire : une seule, ou les orphelines que la
 *  page montrait — leurs adresses, une par ligne. Jamais « toutes les
 *  orphelines » au moment du geste : une image téléversée depuis dans un
 *  formulaire encore ouvert partirait avec, et la fiche enregistrerait ensuite
 *  une adresse morte.
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

    const targets = new Set(
      String(formData.get("id") ?? "")
        .split("\n")
        .filter(Boolean),
    );
    const entries = await listImagesOf(ownerId);
    const candidates = entries.filter((entry) => targets.has(entry.url));
    if (candidates.length === 0) return errorState("Cette image n'est plus là.");

    const uses = await findImageUses(candidates);
    const orphans = candidates.filter((entry) => (uses.get(entry.url) ?? []).length === 0);
    if (orphans.length === 0) {
      return errorState(
        targets.size > 1
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
