import "server-only";

import type { ZodType } from "zod";

import { errorState, type ActionState } from "@/lib/action-state";

import { canContribute, isAdmin, isStoryteller } from "@/lib/permissions";
import { getCurrentUser, type SessionUser } from "@/lib/session";
import { connectToDatabase } from "@/lib/mongoose";

export { errorState, idleState, successState, type ActionState } from "@/lib/action-state";

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
