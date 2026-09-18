import { headers } from "next/headers";
import { cache } from "react";

import { auth } from "@/lib/auth";
import type { Role } from "@/lib/domain";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: Role;
  suspendedUntil?: Date | null;
};

/** La session de la requête en cours. Mémoïsée : appelable depuis plusieurs
 *  composants d'une même page sans relire le cookie à chaque fois. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    role?: string | null;
    suspendedUntil?: Date | string | null;
  };

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: (user.role ?? "membre") as Role,
    suspendedUntil: user.suspendedUntil ? new Date(user.suspendedUntil) : null,
  };
});
