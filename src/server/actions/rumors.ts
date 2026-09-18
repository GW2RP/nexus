"use server";

import { revalidatePath } from "next/cache";

import { canEditContent } from "@/lib/permissions";
import { Character } from "@/models/character";
import { Rumor } from "@/models/rumor";
import {
  errorState,
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
    const character = await Character.findOne({
      _id: parsed.data.characterId,
      authorId: user.id,
    });
    if (!character) {
      return errorState("Choisissez un de vos personnages pour colporter cette rumeur.", {
        characterId: "Ce personnage n'est pas au registre de votre compte.",
      });
    }

    await Rumor.create({
      ...parsed.data,
      placeId: parsed.data.placeId || undefined,
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
 *  qu'une fois, et on peut se rétracter. */
export async function echoRumorAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireContributor();
    const rumorId = String(formData.get("rumorId") ?? "");

    const rumor = await Rumor.findById(rumorId);
    if (!rumor) return errorState("Cette rumeur n'est plus au tableau.");

    const echoes = new Set(rumor.echoedBy ?? []);
    const alreadyEchoed = echoes.has(user.id);
    if (alreadyEchoed) echoes.delete(user.id);
    else echoes.add(user.id);

    rumor.echoedBy = [...echoes];
    rumor.echoCount = echoes.size;
    await rumor.save();

    revalidatePath("/rumeurs");
    return successState(alreadyEchoed ? "Vous ne la reprenez plus." : "Vous l'avez reprise.");
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
    const rumorId = String(formData.get("rumorId") ?? "");

    const rumor = await Rumor.findById(rumorId);
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
