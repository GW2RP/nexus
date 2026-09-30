/**
 * Le statut d'activité d'un lieu : actif ou inactif, et un court message que
 * son équipe écrit avec — « Soirée dansante jusqu'à 21h », « En vacances
 * jusqu'au 12/10 ».
 *
 * Un lieu actif **redevient inactif au bout de `DUREE_ACTIVITE_MS`**, message
 * gardé tel quel : une équipe qui a ouvert sa taverne et s'est déconnectée ne
 * doit pas l'annoncer ouverte jusqu'au lendemain. L'échéance est écrite à
 * l'activation (`until`) et **jugée à la lecture**, jamais par une tâche
 * planifiée : rien à rattraper si un cron saute, et les lectures mémorisées
 * du registre restent vraies — elles portent l'échéance, pas le verdict.
 *
 * Ce module ne touche à rien du serveur : la carte et l'overlay jugent avec la
 * même règle.
 */

/** Combien de temps un lieu reste actif après qu'on l'a déclaré tel. */
export const DUREE_ACTIVITE_MS = 4 * 60 * 60 * 1000;

/** Un message court : il s'affiche sous le nom du lieu, dans une liste. */
export const MESSAGE_ACTIVITE_MAX = 80;

export type PlaceActivity = {
  active: boolean;
  message: string | null;
  /** Depuis quand le lieu est actif — `null` s'il ne l'est pas. */
  since: string | null;
  /** Quand il redeviendra inactif de lui-même — `null` s'il ne l'est pas. */
  until: string | null;
};

/** Le statut tel qu'il est à `maintenant` : un lieu dont l'échéance est
 *  passée est inactif, son message gardé. `null` pour un lieu qui n'a jamais
 *  déclaré de statut — il n'affiche rien, plutôt qu'un « inactif » que
 *  personne n'a dit. */
export function activiteA(
  activity: PlaceActivity | null,
  maintenant: number = Date.now(),
): PlaceActivity | null {
  if (!activity) return null;
  if (!activity.active) return { ...activity, since: null, until: null };
  if (!activity.until || new Date(activity.until).getTime() <= maintenant) {
    return { active: false, message: activity.message, since: null, until: null };
  }
  return activity;
}
