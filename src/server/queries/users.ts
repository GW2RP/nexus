import "server-only";

import type { Role } from "@/lib/domain";
import { User } from "@/models/user";
import {
  type QueryFilter,
  connectToDatabase,
  searchRegex,
  toIso,
  toIsoOrNull,
} from "@/server/queries/shared";

export type UserSort = "recents" | "anciens";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  /** La fin d'une suspension en cours, `null` sinon. */
  suspendedUntil: string | null;
};

/** Le tri départagé par `_id` : deux comptes créés à la même milliseconde ne
 *  changent pas de page d'une lecture à l'autre. */
const SORTS: Record<UserSort, Record<string, 1 | -1>> = {
  recents: { createdAt: -1, _id: -1 },
  anciens: { createdAt: 1, _id: 1 },
};

export const USERS_PAGE_SIZE = 25;

/** La liste des comptes, pour l'administration seulement.
 *
 *  Elle ne passe pas par `remember` : elle porte les adresses mail, et une
 *  inscription passe par Better Auth, qui ne retire aucune étiquette — la
 *  liste cachée oublierait les nouveaux venus. */
export async function listUsers(
  options: { query?: string; sort?: UserSort; page?: number } = {},
) {
  await connectToDatabase();

  const filter: QueryFilter = {};
  if (options.query?.trim()) {
    const regex = searchRegex(options.query);
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const total = await User.countDocuments(filter as never);
  const pageCount = Math.max(1, Math.ceil(total / USERS_PAGE_SIZE));
  // Une page au-delà de la dernière retombe sur la dernière plutôt que sur un vide.
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);

  const docs = await User.find(filter as never)
    .select({ name: 1, email: 1, role: 1, createdAt: 1, suspendedUntil: 1 })
    .sort(SORTS[options.sort ?? "recents"])
    .skip((page - 1) * USERS_PAGE_SIZE)
    .limit(USERS_PAGE_SIZE)
    .lean();

  // Une suspension échue ne s'efface pas en base : elle ne se montre plus.
  const now = Date.now();
  const items: UserRow[] = docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: (doc.role ?? "membre") as Role,
    createdAt: toIso(doc.createdAt),
    suspendedUntil:
      doc.suspendedUntil && doc.suspendedUntil.getTime() > now
        ? toIsoOrNull(doc.suspendedUntil)
        : null,
  }));

  return { items, total, page, pageCount };
}
