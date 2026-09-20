import "server-only";

import { Types } from "mongoose";
import { updateTag } from "next/cache";
import type { ZodType } from "zod";

import { errorState, type ActionState } from "@/lib/action-state";

import { canContribute, isAdmin, isStoryteller } from "@/lib/permissions";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongoose";
import type { Tag } from "@/server/queries/cache";

export { errorState, idleState, successState, type ActionState } from "@/lib/action-state";
export { TAGS } from "@/server/queries/cache";

/** Un identifiant lu dans un champ caché n'est pas forcément un ObjectId.
 *  Sans cette vérification, Mongoose lève une `CastError` dont le message
 *  technique, en anglais, remonterait jusqu'à l'écran. */
export function objectIdOrNull(value: FormDataEntryValue | string | null): string | null {
  if (typeof value !== "string" || !Types.ObjectId.isValid(value)) return null;
  return value;
}

/** Une action réservée aux comptes : refuse le visiteur et le compte suspendu. */
export async function requireContributor(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Cette action demande un compte.");
  if (!canContribute(user)) {
    throw new Error("Votre compte est suspendu : vous ne pouvez plus publier sur le hub.");
  }
  await connectToDatabase();
  return user;
}

export async function requireStoryteller(): Promise<SessionUser> {
  const user = await requireContributor();
  if (!isStoryteller(user)) throw new Error("Cette action est réservée aux conteurs.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireContributor();
  if (!isAdmin(user)) throw new Error("Cette action est réservée à l'administration.");
  return user;
}

/** Valide un FormData et renvoie soit les données, soit les erreurs par champ. */
export function parseForm<T>(
  schema: ZodType<T>,
  formData: FormData,
): { ok: true; data: T } | { ok: false; state: ActionState } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    if (key.endsWith("[]")) {
      const name = key.slice(0, -2);
      const existing = raw[name];
      raw[name] = Array.isArray(existing) ? [...existing, value] : [value];
      continue;
    }
    raw[key] = value;
  }

  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };

  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (path && !fieldErrors[path]) fieldErrors[path] = issue.message;
  }

  return {
    ok: false,
    state: errorState("Le formulaire comporte des erreurs.", fieldErrors),
  };
}

/** Transforme l'exception d'une action en état de formulaire lisible. */
export function toActionState(error: unknown): ActionState {
  const message =
    error instanceof Error ? error.message : "L'action n'a pas abouti. Réessayez.";
  return errorState(message);
}

/** Retire du cache de lecture ce qu'une écriture vient de rendre faux.
 *
 *  `revalidatePath` ne suffit pas : il vide le cache de route, pas les lectures
 *  mémorisées par `remember`. Les deux se posent donc côte à côte — le chemin
 *  pour la page, l'étiquette pour les données qu'elle lit.
 *
 *  `updateTag` et non `revalidateTag` : il périme l'entrée sur-le-champ, là où
 *  le second sert encore du périmé pendant qu'il se refait. Quelqu'un qui vient
 *  d'enregistrer sa fiche doit la voir, pas la précédente — c'est tout l'objet
 *  de la lecture après écriture. Il n'existe que dans une action serveur ; une
 *  route, elle, appelle `revalidateTag`.
 *
 *  Une famille se retire en entier plutôt que fiche par fiche : le hub compte
 *  ses contenus par dizaines, et une invalidation trop fine finirait par
 *  oublier une liste. */
export function invalidate(...tags: Tag[]): void {
  for (const tag of tags) updateTag(tag);
}
