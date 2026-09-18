"use server";

import { revalidatePath } from "next/cache";

import { canEditContent } from "@/lib/permissions";
import { Character } from "@/models/character";
import { Rumor } from "@/models/rumor";
import {
  errorState,
  objectIdOrNull,
  parseForm,
  requireContributor,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { rumorSchema } from "@/server/actions/schemas";

export async function createRumorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const parsed = parseForm(rumorSchema, formData);
    if (!parsed.ok) return parsed.state;

    // Une rumeur est dite par un personnage : il doit être au registre de ce compte.
    const characterId = objectIdOrNull(parsed.data.characterId);
    const character = characterId
      ? await Character.findOne({ _id: characterId, authorId: user.id })
      : null;
    if (!characterId || !character) {
      return errorState("Choisissez un de vos personnages pour colporter cette rumeur.", {
        characterId: "Ce personnage n'est pas au registre de votre compte.",
      });
    }

    await Rumor.create({
      ...parsed.data,
      characterId,
      placeId: objectIdOrNull(parsed.data.placeId ?? null) ?? undefined,
      authorId: user.id,
      echoedBy: [],
      echoCount: 0,
    });
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/rumeurs");
  revalidatePath("/");
  return successState("La rumeur est au tableau.");
}

/** « J'ai entendu ça aussi » : la reprise fait monter la rumeur. On ne reprend
 *  qu'une fois, et on peut se rétracter.
 *
 *  La bascule se fait en une seule écriture, par un pipeline d'agrégation : lire
 *  puis réécrire le document perdrait une reprise sur deux quand plusieurs
 *  comptes reprennent la même rumeur en même temps. */
export async function echoRumorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const rumorId = objectIdOrNull(formData.get("rumorId"));
    if (!rumorId) return errorState("Cette rumeur n'est plus au tableau.");

    const current = { $ifNull: ["$echoedBy", []] };
    const updated = await Rumor.findByIdAndUpdate(
      rumorId,
      [
        {
          $set: {
            echoedBy: {
              $cond: [
                { $in: [user.id, current] },
                { $setDifference: [current, [user.id]] },
                { $concatArrays: [current, [user.id]] },
              ],
            },
          },
        },
        { $set: { echoCount: { $size: "$echoedBy" } } },
      ],
      // Mongoose 9 exige `updatePipeline` pour accepter un pipeline en guise de
      // mise à jour, et `new` y est remplacé par `returnDocument`.
      { returnDocument: "after", updatePipeline: true },
    );

    if (!updated) return errorState("Cette rumeur n'est plus au tableau.");

    revalidatePath("/rumeurs");
    const nowEchoed = (updated.echoedBy ?? []).includes(user.id);
    return successState(nowEchoed ? "Vous l'avez reprise." : "Vous ne la reprenez plus.");
  } catch (error) {
    return toActionState(error);
  }
}

export async function deleteRumorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const rumorId = objectIdOrNull(formData.get("rumorId"));
    const rumor = rumorId ? await Rumor.findById(rumorId) : null;
    if (!rumor) return errorState("Cette rumeur n'est plus au tableau.");
    if (!canEditContent(user, rumor.authorId)) {
      return errorState("Cette rumeur appartient à quelqu'un d'autre.");
    }

    await rumor.deleteOne();
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/rumeurs");
  return successState("La rumeur est retirée du tableau.");
}
