"use server";

import { revalidatePath } from "next/cache";

import { Weather } from "@/models/weather";
import {
  parseForm,
  requireStoryteller,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { weatherSchema } from "@/server/actions/schemas";

/** Poser la météo d'une région : réservé aux conteurs et à l'administration.
 *  Le panneau le dit explicitement à l'écran. */
export async function setWeatherAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireStoryteller();
    const parsed = parseForm(weatherSchema, formData);
    if (!parsed.ok) return parsed.state;

    await Weather.create({ ...parsed.data, authorId: user.id });
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/carte");
  revalidatePath("/");
  return successState("La météo est posée sur la région.");
}

export async function deleteWeatherAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireStoryteller();
    await Weather.findByIdAndDelete(String(formData.get("weatherId") ?? ""));
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/carte");
  return successState("L'entrée de météo est retirée.");
}
