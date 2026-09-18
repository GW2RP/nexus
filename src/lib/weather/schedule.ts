/**
 * Le découpage du temps : un pas toutes les deux heures, à l'heure du serveur
 * de jeu — douze par jour.
 *
 * Tout part d'un numéro de pas, entier et monotone. C'est lui qui fait
 * l'idempotence de l'avancement : deux déclenchements du même pas écrivent le
 * même numéro, et l'index unique en base refuse le second.
 *
 * Attention : Vercel évalue ses tâches planifiées en UTC, sans fuseau. Des
 * horaires fixes dérivent donc d'une heure au passage à l'heure d'été. Rien ici
 * ne regarde l'heure de déclenchement : on lit l'horloge d'`Europe/Paris` et on
 * en déduit le pas dû. Les tâches planifiées ne sont qu'un battement de cœur.
 */

import { GAME_TIME_ZONE } from "@/lib/dates";

export const HOURS_PER_STEP = 2;
export const STEPS_PER_DAY = 24 / HOURS_PER_STEP;

/** Le premier jour du calendrier tyrien : 1er Zéphyr 1332 = 1er septembre 2026. */
const EPOCH_DAY = Math.floor(Date.UTC(2026, 8, 1) / 86_400_000);

export const STEP_SLICES = ["nuit", "matin", "apres-midi", "soiree"] as const;
export type StepSlice = (typeof STEP_SLICES)[number];

export const STEP_SLICE_LABELS: Record<StepSlice, string> = {
  nuit: "Nuit",
  matin: "Matin",
  "apres-midi": "Après-midi",
  soiree: "Soirée",
};

/** Les capitales s'écrivent, elles ne se fabriquent pas : ni `text-transform`,
 *  ni `toUpperCase()` à l'affichage — le lecteur d'écran lit ce qui est écrit. */
export const STEP_SLICE_EYEBROWS: Record<StepSlice, string> = {
  nuit: "NUIT",
  matin: "MATIN",
  "apres-midi": "APRÈS-MIDI",
  soiree: "SOIRÉE",
};

/** Les tranches nomment des moments du jour, pas des pas : à deux heures par
 *  pas, six pas se partagent « nuit » et « matin ». C'est l'heure qui décide. */
const BORNES_DE_TRANCHE: { depuis: number; slice: StepSlice }[] = [
  { depuis: 18, slice: "soiree" },
  { depuis: 12, slice: "apres-midi" },
  { depuis: 6, slice: "matin" },
  { depuis: 0, slice: "nuit" },
];

type Civil = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: GAME_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** L'heure qu'il est à Paris, décomposée. */
function civilAt(date: Date): Civil {
  const parts = PARTS.formatToParts(date);
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

/** De combien de minutes Paris devance UTC à cet instant. */
function offsetMinutesAt(date: Date): number {
  const civil = civilAt(date);
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

/** L'instant dont l'horloge de Paris affiche cette date et cette heure. */
function fromCivil(year: number, month: number, day: number, hour: number): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  // Deux passes : la première corrige le décalage courant, la seconde le cas
  // rare où la correction elle-même traverse un changement d'heure.
  let instant = new Date(guess - offsetMinutesAt(new Date(guess)) * 60_000);
  instant = new Date(guess - offsetMinutesAt(instant) * 60_000);
  return instant;
}

/** Le numéro du pas en cours à cet instant. */
export function stepIndexAt(date: Date): number {
  const civil = civilAt(date);
  const days = Math.floor(Date.UTC(civil.year, civil.month - 1, civil.day) / 86_400_000) - EPOCH_DAY;
  // À deux heures par pas, le changement d'heure ne passe plus inaperçu : au
  // printemps l'heure 2 n'existe pas, donc son numéro n'est jamais rendu ; à
  // l'automne elle a lieu deux fois, donc le même numéro est rendu deux fois.
  // Ni l'un ni l'autre ne gêne : l'avancement va du dernier écrit jusqu'au dû,
  // donc un numéro jamais rendu est quand même produit au passage, et un numéro
  // rendu deux fois se heurte à l'index unique.
  return days * STEPS_PER_DAY + Math.floor(civil.hour / HOURS_PER_STEP);
}

/** Le début d'un pas, à l'heure du serveur de jeu. */
export function stepStart(stepIndex: number): Date {
  const days = Math.floor(stepIndex / STEPS_PER_DAY);
  const slice = stepIndex - days * STEPS_PER_DAY;
  const midnight = new Date((EPOCH_DAY + days) * 86_400_000);
  return fromCivil(
    midnight.getUTCFullYear(),
    midnight.getUTCMonth() + 1,
    midnight.getUTCDate(),
    slice * HOURS_PER_STEP,
  );
}

/** La fin d'un pas : le début du suivant. */
export function stepEnd(stepIndex: number): Date {
  return stepStart(stepIndex + 1);
}

/**
 * Le jour civil parisien d'un pas, à midi UTC.
 *
 * Indispensable : la tranche de nuit commence à 00 h 00 à Paris, soit 22 h ou
 * 23 h UTC **la veille**. Lire la date d'un pas sur son instant UTC la décalerait
 * d'un jour une fois sur quatre — pour la saison comme pour la date tyrienne.
 */
export function civilDayOfStep(stepIndex: number): Date {
  const days = Math.floor(stepIndex / STEPS_PER_DAY);
  return new Date((EPOCH_DAY + days) * 86_400_000 + 12 * 3_600_000);
}

/** Le rang du jour dans l'année civile, de 0 à 365. */
export function dayOfYearOfStep(stepIndex: number): number {
  const day = civilDayOfStep(stepIndex);
  const start = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.floor((day.getTime() - start) / 86_400_000);
}

/** L'heure parisienne à laquelle un pas commence, de 0 à 22. */
export function hourOfStep(stepIndex: number): number {
  const days = Math.floor(stepIndex / STEPS_PER_DAY);
  return (stepIndex - days * STEPS_PER_DAY) * HOURS_PER_STEP;
}

export function sliceOf(stepIndex: number): StepSlice {
  const hour = hourOfStep(stepIndex);
  return BORNES_DE_TRANCHE.find((borne) => hour >= borne.depuis)!.slice;
}

/** « 08 h », pour que douze pas par jour restent distincts à l'affichage. */
export function formatStepHour(stepIndex: number): string {
  return `${String(hourOfStep(stepIndex)).padStart(2, "0")} h`;
}
