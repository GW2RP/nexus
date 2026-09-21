/** L'horloge du serveur de jeu.
 *
 *  Tout le hub lit et écrit ses heures à ce fuseau : c'est celui auquel les
 *  scènes se tiennent. Ces quelques fonctions vivent à part de `dates.ts` pour
 *  que `tyrian-calendar.ts` puisse s'en servir sans rendre les deux modules
 *  dépendants l'un de l'autre — `dates.ts` met déjà en forme des dates
 *  tyriennes. Elles restent réexportées depuis `dates.ts` : c'est là qu'on les
 *  cherche.
 */

export const GAME_TIME_ZONE = "Europe/Paris";

/** L'horloge du serveur de jeu, décomposée.
 *
 *  Une date stockée est un instant UTC ; ce qui se lit et se calcule, c'est
 *  l'heure de Paris. Ajouter sept jours en millisecondes déplacerait la scène
 *  d'une heure au passage à l'heure d'été — 21 h deviendrait 20 h. Toute série
 *  se calcule donc sur ces composantes civiles, jamais sur l'instant. */
export type GameCivil = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const civilParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: GAME_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** L'heure qu'il est sur le serveur de jeu, décomposée. */
export function gameCivil(date: Date): GameCivil {
  const parts = civilParts.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

/** De combien de minutes le serveur de jeu devance UTC à cet instant. */
function gameOffsetMinutes(date: Date): number {
  const civil = gameCivil(date);
  const asUtc = Date.UTC(
    civil.year,
    civil.month - 1,
    civil.day,
    civil.hour,
    civil.minute,
    civil.second,
  );
  return (asUtc - date.getTime()) / 60_000;
}

/** L'instant dont l'horloge du serveur de jeu affiche cette date et cette heure. */
export function fromGameCivil(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : la première corrige le décalage courant, la seconde le cas
  // rare où la correction elle-même traverse un changement d'heure.
  let instant = new Date(guess - gameOffsetMinutes(new Date(guess)) * 60_000);
  instant = new Date(guess - gameOffsetMinutes(instant) * 60_000);
  return instant;
}
