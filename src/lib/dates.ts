import { formatTyrianDate } from "@/lib/tyrian-calendar";

/** Les heures affichées sont celles du serveur de jeu, en Europe/Paris.
 *  Le fuseau est explicite partout : on ne laisse jamais le navigateur décider. */
export const GAME_TIME_ZONE = "Europe/Paris";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: GAME_TIME_ZONE,
});

const shortDateFormatter = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: GAME_TIME_ZONE,
});

const weekdayFormatter = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: GAME_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: GAME_TIME_ZONE,
});

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

const deuxChiffres = (value: number) => String(value).padStart(2, "0");

/** « 2026-10-17T21:00 » — ce qu'un champ `datetime-local` attend, écrit à
 *  l'heure du serveur de jeu. Le formulaire annonce cette horloge : il doit
 *  donc la rendre, et non celle du serveur qui calcule la page. */
export function toGameInput(date: Date): string {
  const civil = gameCivil(date);
  return `${civil.year}-${deuxChiffres(civil.month)}-${deuxChiffres(civil.day)}T${deuxChiffres(
    civil.hour,
  )}:${deuxChiffres(civil.minute)}`;
}

/** Ce qu'un champ `datetime-local` ou `date` désigne, lu à l'heure du serveur
 *  de jeu — et `null` si ce n'est pas une date.
 *
 *  `new Date("2026-10-17T21:00")` lirait la chaîne dans le fuseau du serveur,
 *  UTC sur Vercel : la scène tapée à 21h00 se tiendrait à 23h00 à l'écran.
 *  Un jour sans heure vaut la fin de ce jour-là — « jusqu'au 30 novembre »
 *  inclut le 30 novembre. */
export function fromGameInput(value: string): Date | null {
  const lu = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!lu) return null;
  const [, year, month, day, hour, minute] = lu;
  return hour === undefined
    ? fromGameCivil(Number(year), Number(month), Number(day), 23, 59)
    : fromGameCivil(Number(year), Number(month), Number(day), Number(hour), Number(minute));
}

/** « 2026-11-30 » — ce qu'un champ `date` attend, même horloge. */
export function toGameDateInput(date: Date): string {
  return toGameInput(date).slice(0, 10);
}

/** « samedi 26 septembre 2026 » */
export function formatLongDate(date: Date): string {
  return dateFormatter.format(date);
}

/** « 26 sept. » */
export function formatShortDate(date: Date): string {
  return shortDateFormatter.format(date);
}

/** « sam. » — l'abréviation et son point viennent du format français. */
export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

/** « 20h30 » — la forme que le design system utilise partout. */
export function formatGameTime(date: Date): string {
  return timeFormatter.format(date).replace(":", "h");
}

/** « sam. 20h30 » */
export function formatWeekdayTime(date: Date): string {
  return `${formatWeekday(date)} ${formatGameTime(date)}`;
}

/** « samedi 26 septembre · 89 Scion 1339 · 20h30 → 23h30 » */
export function formatEventWhen(startsAt: Date, endsAt?: Date | null): string {
  const parts = [formatLongDate(startsAt), formatTyrianDate(startsAt)];
  const time = endsAt
    ? `${formatGameTime(startsAt)} → ${formatGameTime(endsAt)}`
    : formatGameTime(startsAt);
  parts.push(time);
  return parts.join(" · ");
}

/** « il y a 2 jours » — utilisé pour l'âge d'une rumeur ou d'un signalement. */
export function formatRelativePast(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days > 1 ? "s" : ""}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  const years = Math.floor(months / 12);
  return `il y a ${years} an${years > 1 ? "s" : ""}`;
}

/** « 26 h » — la colonne « depuis » de la file des signalements. */
export function formatAgeCompact(date: Date, now: Date = new Date()): string {
  const hours = Math.floor((now.getTime() - date.getTime()) / 3_600_000);
  if (hours < 1) return "< 1 h";
  if (hours < 72) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}

/** Le lundi de la semaine qui contient `date`, à minuit, heure de jeu. */
export function startOfGameWeek(date: Date): Date {
  const copy = new Date(date);
  const day = (copy.getUTCDay() + 6) % 7;
  copy.setUTCDate(copy.getUTCDate() - day);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

/** Une valeur pour <time datetime>. */
export function isoDate(date: Date): string {
  return date.toISOString();
}

/**
 * Le jour civil du serveur de jeu, à midi UTC.
 *
 * `toTyrianDate` lit ses composantes en UTC : passé l'instant brut, une soirée
 * d'octobre à 01 h 00 à Paris serait datée de la veille, puisqu'il est encore
 * 23 h 00 en UTC. Midi met la date à l'abri du décalage dans les deux sens.
 */
export function gameDay(date: Date = new Date()): Date {
  const civil = gameCivil(date);
  return new Date(Date.UTC(civil.year, civil.month - 1, civil.day, 12));
}
