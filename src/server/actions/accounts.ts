"use server";

import { User } from "@/models/user";
import { requireContributor } from "@/server/actions/helpers";

/** Les comptes qu'on peut nommer, cherchés par leur pseudo : co-gérant d'un
 *  lieu, invité d'une scène privée, membre d'un groupe.
 *
 *  Les formulaires concernés sont des composants client : ils ne peuvent pas
 *  lire la base directement. Seuls le pseudo et l'identifiant sortent d'ici —
 *  le courriel d'un membre ne regarde personne. */
export async function searchAccountsAction(
  query: string,
): Promise<{ id: string; name: string }[]> {
  await requireContributor();
  const terme = query.trim();
  if (terme.length < 2) return [];

  const escaped = terme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await User.find({ name: new RegExp(escaped, "i") })
    .select({ name: 1 })
    .sort({ name: 1 })
    .limit(8)
    .lean();

  return users.map((found) => ({ id: String(found._id), name: found.name }));
}
