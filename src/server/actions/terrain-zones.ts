"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { errorState, objectIdOrNull, parseForm, requireAdmin, toActionState, type ActionState } from "@/server/actions/helpers";
import { terrainZoneSchema } from "@/server/actions/schemas";
import { TerrainZone } from "@/models/terrain-zone";

/** Une zone change le terrain de la simulation : la carte, la météo et l'accueil
 *  en dépendent tous les trois. */
function revalidateWeather() {
  revalidatePath("/admin/terrains");
  revalidatePath("/meteo");
  revalidatePath("/carte");
  revalidatePath("/");
}

export async function createTerrainZoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requireAdmin();
    const parsed = parseForm(terrainZoneSchema, formData);
    if (!parsed.ok) return parsed.state;

    await TerrainZone.create({ ...parsed.data, authorId: user.id } as never);
  } catch (error) {
    return toActionState(error);
  }

  revalidateWeather();
  redirect("/admin/terrains");
}

export async function updateTerrainZoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const parsed = parseForm(terrainZoneSchema, formData);
    if (!parsed.ok) return parsed.state;

    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await TerrainZone.findById(id) : null;
    if (!existing) return errorState("Cette zone n'existe plus.");

    existing.set(parsed.data);
    await existing.save();
  } catch (error) {
    return toActionState(error);
  }

  revalidateWeather();
  redirect("/admin/terrains");
}

export async function deleteTerrainZoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = objectIdOrNull(formData.get("id"));
    const existing = id ? await TerrainZone.findById(id) : null;
    if (!existing) return errorState("Cette zone n'existe plus.");
    await existing.deleteOne();
  } catch (error) {
    return toActionState(error);
  }

  revalidateWeather();
  redirect("/admin/terrains");
}
