import "server-only";

import type { z } from "zod";

import { activiteA, DUREE_ACTIVITE_MS, type PlaceActivity } from "@/lib/place-activity";
import { canEditPlace } from "@/lib/permissions";
import type { SessionUser } from "@/lib/session";
import { Place } from "@/models/place";
import type { placeActivitySchema } from "@/server/actions/schemas";
import { connectToDatabase, toIsoOrNull } from "@/server/queries/shared";

/**
 * L'écriture du statut d'un lieu, partagée par l'action de la fiche et la
 * route de l'application bureau : une seule règle de qui peut le basculer et
 * de ce qu'une bascule écrit.
 *
 * Basculer **actif** pose l'échéance à `DUREE_ACTIVITE_MS` d'ici — sauf si le
 * lieu l'est déjà : corriger son message ne rallonge pas la soirée. Basculer
 * **inactif** retire l'échéance et garde le message. Le lieu n'en est pas
 * « modifié » pour autant (`timestamps: false`) : sa fiche n'a pas changé, et
 * sa date de modification — celle du plan du site — non plus.
 */

export class ActiviteRefusee extends Error {
  constructor(
    message: string,
    readonly statut: 403 | 404,
  ) {
    super(message);
  }
}

export async function ecrireActivite(
  user: SessionUser,
  cible: { id: string } | { slug: string },
  demande: z.infer<typeof placeActivitySchema>,
): Promise<{ slug: string; activity: PlaceActivity }> {
  await connectToDatabase();
  const place = await Place.findOne({
    ...("id" in cible ? { _id: cible.id } : { slug: cible.slug }),
    hidden: { $ne: true },
  })
    .select({ slug: 1, authorId: 1, managerIds: 1, activity: 1 })
    .lean();
  if (!place) throw new ActiviteRefusee("Ce lieu n'existe plus.", 404);
  if (!canEditPlace(user, { authorId: place.authorId, managerIds: place.managerIds ?? [] })) {
    throw new ActiviteRefusee("Seule l'équipe du lieu en change le statut.", 403);
  }

  const avant = activiteA(
    place.activity
      ? {
          active: Boolean(place.activity.active),
          message: place.activity.message ?? null,
          since: toIsoOrNull(place.activity.since),
          until: toIsoOrNull(place.activity.until),
        }
      : null,
  );
  const message =
    demande.message === undefined ? (avant?.message ?? null) : demande.message || null;

  const maintenant = Date.now();
  const since = demande.active
    ? avant?.active && avant.since
      ? new Date(avant.since)
      : new Date(maintenant)
    : null;
  const until = demande.active
    ? avant?.active && avant.until
      ? new Date(avant.until)
      : new Date(maintenant + DUREE_ACTIVITE_MS)
    : null;

  await Place.updateOne(
    { _id: place._id },
    {
      $set: {
        activity: {
          active: demande.active,
          ...(message ? { message } : {}),
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
        },
      },
    },
    { timestamps: false },
  );

  return {
    slug: place.slug,
    activity: {
      active: demande.active,
      message,
      since: since?.toISOString() ?? null,
      until: until?.toISOString() ?? null,
    },
  };
}
