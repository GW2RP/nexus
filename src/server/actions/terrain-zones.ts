"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  invalidate,
  TAGS,
  errorState,
  objectIdOrNull,
  idleState,
  parseForm,
  requireAdmin,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { terrainZoneSchema } from "@/server/actions/schemas";
import { ORDRE_DAPPLICATION, TerrainZone } from "@/models/terrain-zone";

/** Une zone change le terrain de la simulation : la carte, la météo et l'accueil
 *  en dépendent tous les trois. */
function revalidateWeather() {
  invalidate(TAGS.terrain);
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

    // Une zone nouvelle se pose **au-dessus** des autres : on dessine presque
    // toujours un détail sur un fond déjà là.
    //
    // Le rang se prend sur le plus haut existant, et non sur le nombre de zones :
    // une suppression laisse un trou dans la numérotation, et compter donnerait
    // alors un rang déjà pris. Vérifié — huit zones numérotées 2 à 9, la nouvelle
    // prenait le rang 8 et se posait avant « Marais de fer », pas après.
    //
    // Aucune zone numérotée — une liste jamais réordonnée n'en a aucune — et le
    // rang vaut zéro : un champ absent trie avant tout nombre, donc la nouvelle
    // passe quand même en dernier.
    const plusHaut = await TerrainZone.findOne({ rang: { $ne: null } }, { rang: 1 })
      .sort({ rang: -1 })
      .lean();
    const rang = typeof plusHaut?.rang === "number" ? plusHaut.rang + 1 : 0;
    await TerrainZone.create({ ...parsed.data, rang, authorId: user.id } as never);
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

/**
 * Déplace une zone d'un cran dans l'ordre d'application.
 *
 * Le rang n'est pas incrémenté sur place : on relit la liste dans son ordre, on
 * y échange deux voisines, et on **renumérote tout** de zéro. C'est ce qui rend
 * l'opération sûre quand des zones d'avant le rang n'en portent aucun — le
 * premier déplacement les numérote toutes, dans l'ordre où elles se cuisaient
 * déjà — et ce qui interdit deux zones au même rang, où l'ordre retomberait sur
 * la date de création sans que rien ne le dise.
 */
export async function moveTerrainZoneAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const id = objectIdOrNull(formData.get("id"));
    if (!id) return errorState("Cette zone n'existe plus.");
    const sens = formData.get("sens");
    if (sens !== "avant" && sens !== "apres") return errorState("Déplacement inconnu.");

    const ordre = await TerrainZone.find({}, { _id: 1 }).sort(ORDRE_DAPPLICATION).lean();
    const depart = ordre.findIndex((zone) => String(zone._id) === id);
    if (depart < 0) return errorState("Cette zone n'existe plus.");

    const arrivee = depart + (sens === "avant" ? -1 : 1);
    // Aux extrémités il n'y a rien à faire : le bouton qui aurait servi est déjà
    // éteint, et une seconde soumission ne peut venir que d'ailleurs.
    if (arrivee < 0 || arrivee >= ordre.length) return idleState;

    [ordre[depart], ordre[arrivee]] = [ordre[arrivee], ordre[depart]];
    await TerrainZone.bulkWrite(
      ordre.map((zone, rang) => ({
        updateOne: { filter: { _id: zone._id }, update: { $set: { rang } } },
      })),
    );
  } catch (error) {
    return toActionState(error);
  }

  revalidateWeather();
  // Un déplacement réussi n'a rien à dire : la liste se renumérote sous les yeux
  // et la ligne annonce son nouveau rang. Un encart vert de plus ne serait qu'un
  // doublon à lire.
  return idleState;
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
