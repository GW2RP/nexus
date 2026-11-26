/**
 * La présence à un lieu : combien de temps une déclaration vit.
 *
 * Depuis le **site**, deux heures, renouvelables : personne ne la confirme,
 * donc elle doit tomber d'elle-même le soir venu. Depuis l'**overlay**, un
 * quart d'heure, que l'application renouvelle tant que le personnage reste
 * près du lieu : le jeu fermé, elle tombe vite.
 *
 * Ce module ne touche à rien du serveur : la fiche et ses formulaires le lisent.
 */

export const DUREE_PRESENCE_SITE_MS = 2 * 60 * 60 * 1000;
export const DUREE_PRESENCE_OVERLAY_MS = 15 * 60 * 1000;

export const SOURCES_PRESENCE = ["overlay", "site"] as const;
export type SourcePresence = (typeof SOURCES_PRESENCE)[number];

/** Un nom de personnage tel que le jeu l'écrit : 19 caractères au plus. Ce
 *  que l'overlay envoie ne peut pas être plus long qu'un vrai nom. */
export const NOM_EN_JEU_MAX = 19;

/** Une présence déclarée, telle que le compte la relit. */
export type PresenceDeclaree = {
  lieu: { id: string; slug: string; name: string; coordinates: { x: number; y: number } | null };
  personnage: { name: string; slug: string | null } | null;
  source: SourcePresence;
  since: string;
  until: string;
};

/** Quelqu'un au lieu, tel que tout le monde le lit sur la fiche. */
export type Present = {
  name: string;
  /** La fiche du personnage, s'il en a une. */
  slug: string | null;
  since: string;
};
