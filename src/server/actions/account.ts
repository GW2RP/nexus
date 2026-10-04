"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth";
import { ROLES, type Role } from "@/lib/domain";
import { User } from "@/models/user";
import {
  errorState,
  parseForm,
  objectIdOrNull,
  requireAdmin,
  successState,
  toActionState,
  type ActionState,
} from "@/server/actions/helpers";
import { adminPasswordSchema } from "@/server/actions/schemas";

/** Le rôle est posé par l'administration, jamais choisi à l'inscription. */
export async function setUserRoleAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const userId = objectIdOrNull(formData.get("userId"));
    const role = String(formData.get("role") ?? "") as Role;
    if (!ROLES.includes(role)) return errorState("Ce rôle n'existe pas.");

    const updated = userId ? await User.findByIdAndUpdate(userId, { role }) : null;
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
    const userId = objectIdOrNull(formData.get("userId"));
    const updated = userId
      ? await User.findByIdAndUpdate(userId, { $unset: { suspendedUntil: "" } })
      : null;
    if (!updated) return errorState("Ce compte n'existe plus.");
  } catch (error) {
    return toActionState(error);
  }

  revalidatePath("/admin/membres");
  return successState("La suspension est levée.");
}

/** Poser un nouveau mot de passe sur le compte d'un autre — celui qui a perdu
 *  le sien, faute de courriel de réinitialisation branché.
 *
 *  Toutes ses sessions se ferment, l'application bureau comprise : si le compte
 *  a été pris, l'intrus ne garde pas la sienne. Le cache de cookie de Better
 *  Auth peut laisser une session ouverte quelques minutes au plus.
 *
 *  Son propre mot de passe se change depuis « Mon compte », avec l'ancien : ici,
 *  l'administration se fermerait elle-même toutes ses sessions sans le prouver. */
export async function setUserPasswordAction(
  userId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const parsed = parseForm(adminPasswordSchema, formData);
    if (!parsed.ok) return parsed.state;

    const id = objectIdOrNull(userId);
    if (!id) return errorState("Ce compte n'existe plus.");
    if (id === admin.id) {
      return errorState("Votre propre mot de passe se change depuis votre compte.");
    }

    const context = await auth.$context;
    const user = await context.internalAdapter.findUserById(id);
    if (!user) return errorState("Ce compte n'existe plus.");
    if (!(await context.internalAdapter.findCredentialAccount(id))) {
      return errorState("Ce compte n'a pas de mot de passe à changer.");
    }

    const hash = await context.password.hash(parsed.data.password);
    await context.internalAdapter.updatePassword(id, hash);
    await context.internalAdapter.deleteUserSessions(id);
  } catch (error) {
    return toActionState(error);
  }

  return successState("Le mot de passe est changé. Ses sessions sont fermées.");
}
