import "server-only";

import { unstable_cache } from "next/cache";

/** Le cache de lecture du hub.
 *
 *  **Ce n'est pas la page qui est cachée, ce sont ses données.** Une page du hub
 *  lit la session — ne serait-ce que par l'en-tête, qui affiche le pseudo — donc
 *  elle est rendue à la requête et Vercel ne peut pas la servir depuis son cache
 *  de routes : toutes les réponses sortent en `x-vercel-cache: MISS`. Ce qu'elle
 *  lit, en revanche, ne dépend pas du lecteur : le registre des personnages est
 *  le même pour tout le monde. Sans ce cache, cliquer un filtre refaisait le
 *  trajet complet jusqu'à Atlas pour recomposer une liste identique à un champ
 *  près.
 *
 *  **Rien n'expire par l'horloge**, sauf mention contraire au point d'appel :
 *  chaque écriture invalide l'étiquette de sa famille (`revalidateTag`), donc
 *  une fiche enregistrée est visible au rendu suivant. Un délai d'expiration
 *  ajouterait du retard sans rien garantir de plus.
 *
 *  Une fonction cachée **ne lit ni `cookies()` ni `headers()`** : ce qui dépend
 *  du lecteur se calcule autour d'elle, pas dedans. C'est la raison pour
 *  laquelle les listes qui portent un état de lecteur — l'inscription à une
 *  scène, la reprise d'une rumeur — ne passent pas par ici. */

export const TAGS = {
  characters: "personnages",
  places: "lieux",
  events: "evenements",
  rumors: "rumeurs",
  weather: "meteo",
  terrain: "terrains",
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

// La signature reprend celle d'`unstable_cache` : un paramètre par défaut —
// `limit = 3` — ne s'infère pas à travers un `A extends unknown[]`, et la
// fonction cachée se retrouverait avec des arguments `unknown`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Read = (...args: any[]) => Promise<any>;

/** Mémorise le résultat d'une lecture, jusqu'à ce qu'une écriture le retire.
 *
 *  `keyParts` nomme l'entrée ; les arguments de l'appel s'y ajoutent
 *  automatiquement, donc une liste filtrée par race a son entrée à elle.
 *
 *  `seconds` ne sert qu'aux lectures dont le résultat dépend de l'heure qu'il
 *  est plutôt que de ce qui est écrit en base — là, aucune écriture ne viendrait
 *  les invalider. */
export function remember<T extends Read>(
  read: T,
  keyParts: string[],
  tags: Tag[],
  seconds?: number,
): T {
  return unstable_cache(read, keyParts, {
    tags,
    // `false` dit « jusqu'à nouvel ordre » : seules les étiquettes invalident.
    revalidate: seconds ?? false,
  });
}
