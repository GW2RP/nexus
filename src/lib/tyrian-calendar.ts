/** Le calendrier tyrien.
 *
 *  Quatre saisons de 90 jours — Zéphyr, Phénix, Scion, Colosse — et une année qui
 *  compte à partir de l'Ère du Dragon. Le hub affiche toujours la date réelle en
 *  premier et la date tyrienne en second : c'est un choix de lisibilité, pris avec
 *  le design system, à ne pas inverser sans en reparler.
 */

export const TYRIAN_SEASONS = ["Zéphyr", "Phénix", "Scion", "Colosse"] as const;
export type TyrianSeason = (typeof TYRIAN_SEASONS)[number];

/** L'ancrage : le 1er Zéphyr 1332 AE tombe le 1ᵉʳ septembre 2026. */
const EPOCH = Date.UTC(2026, 8, 1);
const EPOCH_YEAR = 1332;
const DAYS_PER_SEASON = 90;
const DAYS_PER_YEAR = DAYS_PER_SEASON * TYRIAN_SEASONS.length;
const MS_PER_DAY = 86_400_000;

export type TyrianDate = {
  day: number;
  season: TyrianSeason;
  seasonIndex: number;
  year: number;
};

export function toTyrianDate(date: Date): TyrianDate {
  const utcDay = Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / MS_PER_DAY,
  );
  const epochDay = Math.floor(EPOCH / MS_PER_DAY);
  const elapsed = utcDay - epochDay;

  const yearOffset = Math.floor(elapsed / DAYS_PER_YEAR);
  const dayOfYear = ((elapsed % DAYS_PER_YEAR) + DAYS_PER_YEAR) % DAYS_PER_YEAR;
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON);

  return {
    day: (dayOfYear % DAYS_PER_SEASON) + 1,
    season: TYRIAN_SEASONS[seasonIndex],
    seasonIndex,
    year: EPOCH_YEAR + yearOffset,
  };
}

/** « 21 Zéphyr 1332 » */
export function formatTyrianDate(date: Date, options: { year?: boolean } = {}): string {
  const tyrian = toTyrianDate(date);
  const year = options.year === false ? "" : ` ${tyrian.year}`;
  return `${tyrian.day} ${tyrian.season}${year}`;
}

/** « Saison de Zéphyr 1332 » */
export function formatTyrianSeason(date: Date): string {
  const tyrian = toTyrianDate(date);
  return `Saison de ${tyrian.season} ${tyrian.year}`;
}
