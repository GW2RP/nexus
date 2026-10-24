import { cache } from "react";

import { getCurrentUser } from "@/lib/session";
import { getGroupBoard } from "@/server/queries/boards";
import { getGroupBySlug } from "@/server/queries/groups";

/** Le panneau d'un groupe et ce qu'il faut pour en juger l'accès : la page du
 *  panneau et son exploration en VR lisent la même chose, par la même règle.
 *  Les métadonnées et la page le demandent toutes deux : `cache` ne fait
 *  qu'une lecture par requête. */
export const loadGroupBoard = cache(async (slug: string, id: string) => {
  const user = await getCurrentUser();
  const group = await getGroupBySlug(slug, user);
  if (!group) return null;
  const groupAccess = {
    id: group.id,
    slug: group.slug,
    visibility: group.visibility,
    authorId: group.authorId,
    memberIds: group.members.map((member) => member.id),
  };
  const found = await getGroupBoard(groupAccess, id, user);
  if (!found) return null;
  return { user, group, groupAccess, ...found };
});
