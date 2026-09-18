"use server";

import { revalidatePath } from "next/cache";

import { ROLES, type Role } from "@/lib/domain";
import { User } from "@/models/user";
import {
  errorState,
  requireAdmin,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";

/** Le rôle est posé par l'administration, jamais choisi à l'inscription. */
export async function setUserRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "") as Role;
    if (!ROLES.includes(role)) return errorState("Ce rôle n'existe pas.");

    const updated = await User.findByIdAndUpdate(userId, { role });
    if (!updated) return errorState("Ce compte n'existe plus.");
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/admin/membres");
  return successState("Le rôle est posé.");
}

/** Lever une suspension avant son terme. */
export async function liftSuspensionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const userId = String(formData.get("userId") ?? "");
    const updated = await User.findByIdAndUpdate(userId, { $unset: { suspendedUntil: "" } });
    if (!updated) return errorState("Ce compte n'existe plus.");
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/admin/membres");
  return successState("La suspension est levée.");
}
