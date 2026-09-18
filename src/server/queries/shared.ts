import "server-only";

import { Types } from "mongoose";

import { connectToDatabase } from "@/lib/mongoose";
import { User } from "@/models/user";
import type { AuthorSummary } from "@/server/types";

export { connectToDatabase };

export function toId(value: unknown): string {
  return String(value);
}

export function toObjectId(value: string): Types.ObjectId | null {
  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;
}

export function toIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}

export function toIsoOrNull(value: unknown): string | null {
  if (!value) return null;
  return toIso(value);
}

/** Charge les comptes cités par une liste de contenus, en une requête.
 *  Les identifiants viennent de Better Auth : ce sont des ObjectId sérialisés. */
export async function loadAuthors(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const objectIds = unique.map(toObjectId).filter((id): id is Types.ObjectId => id !== null);
  if (objectIds.length === 0) return new Map<string, AuthorSummary>();

  const users = await User.find({ _id: { $in: objectIds } })
    .select({ name: 1 })
    .lean();

  return new Map<string, AuthorSummary>(
    users.map((user) => [String(user._id), { id: String(user._id), name: user.name }]),
  );
}

/** Un mot-clé de recherche transformé en expression régulière sûre. */
export function searchRegex(query: string): RegExp {
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

/** Un filtre monté champ par champ. Mongoose caste les valeurs à l'exécution ;
 *  ses génériques, eux, n'acceptent pas qu'on remplisse l'objet après coup. */
export type QueryFilter = Record<string, unknown>;

export const PAGE_SIZE = 12;
