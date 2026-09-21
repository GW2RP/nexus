/** Le calendrier mouvélien — « la date tyrienne » dans le hub.
 *
 *  Quatre saisons et **365 jours**. Les trois premières comptent 90 jours ; la
 *  dernière en compte 95, parce que les cinq jours cachés annoncés par Mikk lui
 *  ont été rattachés. Une année de 4 × 90 jours dériverait de cinq jours par an
 *  sur le calendrier réel, et la saison finirait par ne plus tomber à la bonne
 *  époque de l'année.
 *
 *  La conversion est celle du modèle `Mouvelian` du wiki officiel, et elle est
 *  calquée sur le calendrier grégorien : **même rang de jour dans l'année**, et
 *  l'année de l'Exode vaut l'année grégorienne moins 687 — 2012, l'année de
 *  sortie du jeu, est 1325 AE. Il n'y a donc pas d'ancrage à poser : la date
 *  tyrienne est une autre façon d'écrire la date réelle, pas un compte à part
 *  qui partirait d'un jour choisi.
 *
 *  Le hub affiche toujours la date réelle en premier et la date tyrienne en
 *  second : c'est un choix de lisibilité, pris avec le design system, à ne pas
 *  inverser sans en reparler.
 *
 *  @see https://wiki.guildwars2.com/wiki/Mouvelian_calendar
 */

export const TYRIAN_SEASONS = ["Zéphyr", "Phénix", "Scion", "Colosse"] as const;
export type TyrianSeason = (typeof TYRIAN_SEASONS)[number];

/** L'écart entre les deux comptes d'années : 2012 = 1325 AE. */
const ECART_ANNEES = 687;
/** Les trois premières saisons ; la quatrième garde le reste de l'année. */
const JOURS_PAR_SAISON = 90;
const MS_PAR_JOUR = 86_400_000;
/** Le rang du 28 février, à partir de zéro. */
const RANG_28_FEVRIER = 58;

export type TyrianDate = {
  day: number;
  season: TyrianSeason;
  seasonIndex: number;
  year: number;
};

function estBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

export function toTyrianDate(date: Date): TyrianDate {
  const annee = date.getUTCFullYear();
  const debutDAnnee = Date.UTC(annee, 0, 1);
  const jour = Date.UTC(annee, date.getUTCMonth(), date.getUTCDate());
  let rang = Math.floor((jour - debutDAnnee) / MS_PAR_JOUR);

  // Le 29 février prend le rang du 28 : l'année tyrienne n'a pas de jour
  // bissextile, et le faire partager son rang coûte un jour tous les quatre ans
  // là où le décaler emporterait tout le reste de l'année avec lui.
  if (estBissextile(annee) && rang > RANG_28_FEVRIER) rang -= 1;

  // La dernière saison ramasse les cinq jours cachés : sans ce plafond, le
  // 31 décembre tomberait dans une cinquième saison qui n'existe pas.
  const seasonIndex = Math.min(Math.floor(rang / JOURS_PAR_SAISON), TYRIAN_SEASONS.length - 1);

  return {
    day: rang - seasonIndex * JOURS_PAR_SAISON + 1,
    season: TYRIAN_SEASONS[seasonIndex],
    seasonIndex,
    year: annee - ECART_ANNEES,
  };
}

/** « 84 Scion 1339 » */
export function formatTyrianDate(date: Date, options: { year?: boolean } = {}): string {
  const tyrian = toTyrianDate(date);
  const year = options.year === false ? "" : ` ${tyrian.year}`;
  return `${tyrian.day} ${tyrian.season}${year}`;
}

/** « Saison du Scion 1339 » — les quatre saisons prennent « du ». */
export function formatTyrianSeason(date: Date): string {
  const tyrian = toTyrianDate(date);
  return `Saison du ${tyrian.season} ${tyrian.year}`;
}
