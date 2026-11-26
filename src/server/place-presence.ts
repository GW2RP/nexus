import "server-only";

import {
  DUREE_PRESENCE_OVERLAY_MS,
  DUREE_PRESENCE_SITE_MS,
  type PresenceDeclaree,
  type Present,
  type SourcePresence,
} from "@/lib/place-presence";
import type { SessionUser } from "@/lib/session";
import { Character } from "@/models/character";
import { Place } from "@/models/place";
import { PlacePresence } from "@/models/place-presence";
import { connectToDatabase, toObjectId } from "@/server/queries/shared";

/**
 * La présence à un lieu — « je suis à la Taverne du Lion » —, écrite et lue
 * ici seulement : par la fiche du lieu, et par l'application bureau, qui la
 * propose quand le personnage passe à côté.
 *
 * **Rien de cela ne passe par `remember`** : la fréquentation est l'état du
 * moment, elle change à chaque arrivée et chaque départ, et une étiquette
 * retirée à chaque geste ne servirait jamais son entrée. Les comptes se lisent
 * en une agrégation sur une collection qui ne compte que les présents, et se
 * joignent aux listes **à la sortie** de leur cache, comme le statut d'un lieu.
 *
 * L'échéance se juge à la lecture (`until > maintenant`) : l'index
 * d'expiration de Mongo ne passe qu'une fois par minute, et une présence
 * échue ne doit pas s'afficher en attendant son ménage.
 */

export class PresenceRefusee extends Error {
  constructor(
    message: string,
    readonly statut: 400 | 404,
  ) {
    super(message);
  }
}

function propre(nom: string): string {
  return nom.trim().replace(/\s+/g, " ");
}

/** Deux noms se valent sans la casse ni les espaces : « aerin  valcourt »
 *  est la fiche d'« Aerin Valcourt ». */
function memeNom(a: string, b: string): boolean {
  return propre(a).toLocaleLowerCase("fr-FR") === propre(b).toLocaleLowerCase("fr-FR");
}

/**
 * Se déclarer à un lieu, ou y renouveler sa déclaration.
 *
 * Le personnage se désigne par sa fiche (`characterId`, depuis le site) ou
 * par son nom en jeu (`characterName`, depuis l'overlay). Une fiche doit être
 * à ce compte ; un nom en jeu retrouve la fiche du compte qui porte le même,
 * et sinon s'affiche tel quel — c'est le nom que les autres joueurs lisent
 * au-dessus de sa tête.
 *
 * Renouveler au même lieu garde l'heure d'arrivée ; changer de lieu la
 * remet à maintenant.
 */
export async function declarerPresence(
  user: SessionUser,
  cible: { id: string } | { slug: string },
  demande: { characterId?: string; characterName?: string; source: SourcePresence },
): Promise<PresenceDeclaree> {
  await connectToDatabase();
  const filtreLieu =
    "id" in cible ? { _id: toObjectId(cible.id) } : { slug: cible.slug };
  if ("id" in cible && !filtreLieu._id) throw new PresenceRefusee("Ce lieu n'existe plus.", 404);
  const place = await Place.findOne({ ...filtreLieu, hidden: { $ne: true } })
    .select({ slug: 1, name: 1, coordinates: 1 })
    .lean();
  if (!place) throw new PresenceRefusee("Ce lieu n'existe plus.", 404);

  const personnages = await Character.find({ authorId: user.id, hidden: { $ne: true } })
    .select({ name: 1, slug: 1 })
    .lean();
  let fiche: { _id: unknown; name: string; slug: string } | null = null;
  let nom: string;
  if (demande.characterId) {
    fiche = personnages.find((personnage) => String(personnage._id) === demande.characterId) ?? null;
    if (!fiche) throw new PresenceRefusee("Ce personnage n'est pas le vôtre.", 400);
    nom = fiche.name;
  } else if (demande.characterName && propre(demande.characterName)) {
    nom = propre(demande.characterName);
    fiche = personnages.find((personnage) => memeNom(personnage.name, nom)) ?? null;
    if (fiche) nom = fiche.name;
  } else {
    throw new PresenceRefusee("Choisissez le personnage qui s'y tient.", 400);
  }

  const maintenant = new Date();
  const until = new Date(
    maintenant.getTime() +
      (demande.source === "overlay" ? DUREE_PRESENCE_OVERLAY_MS : DUREE_PRESENCE_SITE_MS),
  );
  const avant = await PlacePresence.findOne({ userId: user.id }).lean();
  const memeLieu =
    avant && String(avant.placeId) === String(place._id) && avant.until.getTime() > maintenant.getTime();
  const since = memeLieu ? avant.since : maintenant;

  await PlacePresence.updateOne(
    { userId: user.id },
    {
      $set: {
        placeId: place._id,
        characterName: nom,
        source: demande.source,
        since,
        until,
        ...(fiche ? { characterId: fiche._id } : {}),
      },
      ...(fiche ? {} : { $unset: { characterId: "" } }),
    },
    { upsert: true },
  );

  return {
    lieu: {
      id: String(place._id),
      slug: place.slug,
      name: place.name,
      coordinates: coordonnees(place.coordinates),
    },
    personnage: { name: nom, slug: fiche?.slug ?? null },
    source: demande.source,
    since: since.toISOString(),
    until: until.toISOString(),
  };
}

function coordonnees(
  valeur: { x?: number | null; y?: number | null } | null | undefined,
): { x: number; y: number } | null {
  return typeof valeur?.x === "number" && typeof valeur?.y === "number"
    ? { x: valeur.x, y: valeur.y }
    : null;
}

/** Quitter le lieu où l'on s'était déclaré. Rend le slug du lieu quitté, pour
 *  revalider sa fiche, ou `null` si l'on n'était nulle part. */
export async function quitterPresence(user: SessionUser): Promise<string | null> {
  await connectToDatabase();
  const avant = await PlacePresence.findOneAndDelete({ userId: user.id }).lean();
  if (!avant) return null;
  const place = await Place.findById(avant.placeId).select({ slug: 1 }).lean();
  return place?.slug ?? null;
}

/** La présence du compte, ou `null` s'il n'est nulle part — ou plus : une
 *  déclaration échue n'est plus une présence. */
export async function presenceDe(userId: string): Promise<PresenceDeclaree | null> {
  await connectToDatabase();
  const presence = await PlacePresence.findOne({ userId, until: { $gt: new Date() } }).lean();
  if (!presence) return null;
  const [place, fiche] = await Promise.all([
    Place.findOne({ _id: presence.placeId, hidden: { $ne: true } })
      .select({ slug: 1, name: 1, coordinates: 1 })
      .lean(),
    presence.characterId
      ? Character.findOne({ _id: presence.characterId, hidden: { $ne: true } })
          .select({ slug: 1 })
          .lean()
      : null,
  ]);
  if (!place) return null;
  return {
    lieu: {
      id: String(place._id),
      slug: place.slug,
      name: place.name,
      coordinates: coordonnees(place.coordinates),
    },
    personnage: presence.characterName
      ? { name: presence.characterName, slug: fiche?.slug ?? null }
      : null,
    source: presence.source,
    since: presence.since.toISOString(),
    until: presence.until.toISOString(),
  };
}

/** Qui est au lieu, les premiers arrivés d'abord. Une fiche masquée par la
 *  modération ne prête plus son lien, mais son joueur reste là. */
export async function presentsAuLieu(placeId: string): Promise<Present[]> {
  await connectToDatabase();
  const id = toObjectId(placeId);
  if (!id) return [];
  const presences = await PlacePresence.find({ placeId: id, until: { $gt: new Date() } })
    .sort({ since: 1 })
    .lean();
  const ids = presences.flatMap((presence) => (presence.characterId ? [presence.characterId] : []));
  const fiches =
    ids.length > 0
      ? await Character.find({ _id: { $in: ids }, hidden: { $ne: true } })
          .select({ slug: 1 })
          .lean()
      : [];
  const slugs = new Map(fiches.map((fiche) => [String(fiche._id), fiche.slug]));
  return presences.flatMap((presence) =>
    presence.characterName
      ? [
          {
            name: presence.characterName,
            slug: presence.characterId ? (slugs.get(String(presence.characterId)) ?? null) : null,
            since: presence.since.toISOString(),
          },
        ]
      : [],
  );
}

/** Combien de présents à chaque lieu qui en a, par identifiant de lieu. */
export async function presentsParLieu(): Promise<Record<string, number>> {
  await connectToDatabase();
  const groupes = await PlacePresence.aggregate<{ _id: unknown; total: number }>([
    { $match: { until: { $gt: new Date() } } },
    { $group: { _id: "$placeId", total: { $sum: 1 } } },
  ]);
  return Object.fromEntries(groupes.map((groupe) => [String(groupe._id), groupe.total]));
}

/** Joint le compte des présents à des lieux sortis de leur cache. */
export async function avecPresents<T extends { id: string }>(
  lieux: T[],
): Promise<(T & { presentCount: number })[]> {
  const comptes = lieux.length > 0 ? await presentsParLieu() : {};
  return lieux.map((lieu) => ({ ...lieu, presentCount: comptes[lieu.id] ?? 0 }));
}
