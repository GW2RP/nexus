import {
  GAME_TIME_ZONE,
  fromGameCivil,
  gameCivil,
  type GameCivil,
} from "@/lib/game-time";
import { formatTyrianDate } from "@/lib/tyrian-calendar";

/** Les heures affichées sont celles du serveur de jeu, en Europe/Paris.
 *  Le fuseau est explicite partout : on ne laisse jamais le navigateur décider.
 *
 *  L'horloge elle-même vit dans `game-time.ts`, pour que le calendrier tyrien
 *  puisse s'en servir sans dépendre d'ici — `formatEventWhen` met en forme une
 *  date tyrienne, donc la dépendance inverse existe déjà. Elle se lit toujours
 *  depuis ce module : rien à changer aux appels. */
export { GAME_TIME_ZONE, fromGameCivil, gameCivil, type GameCivil };

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
