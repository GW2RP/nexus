/**
 * Les séries : une règle, et les dates qu'elle produit.
 *
 * Tout se calcule sur l'horloge du serveur de jeu, jamais sur l'instant UTC.
 * Ajouter sept fois 86 400 000 millisecondes déplacerait la veillée de 21 h à
 * 20 h au passage à l'heure d'été : on ajoute donc sept jours **civils**, et on
 * recompose l'instant à l'heure voulue.
 *
 * Ce module est pur — aucune base, aucune horloge implicite. C'est ce qui
 * permet au formulaire d'afficher les prochaines séances avant d'enregistrer
 * quoi que ce soit, et à l'aperçu de dire la vérité.
 */

import { fromGameCivil, gameCivil } from "@/lib/dates";
import type { MonthlyMode, Recurrence } from "@/lib/domain";

/** Ce qu'une série écrit d'avance. Une série sans fin n'est pas infinie en
 *  base : elle se prolonge à la demande, depuis la page des séances. Écrire
 *  cinquante-deux annonces pour une veillée hebdomadaire remplirait l'agenda
 *  d'un an de scènes que personne n'a encore promises. */
export const OCCURRENCES_PAR_LOT = 12;

/** La borne dure d'une série, tous prolongements compris. */
export const OCCURRENCES_MAX = 60;

export type SeriesRule = {
  recurrence: Exclude<Recurrence, "aucune">;
  /** Ne sert qu'aux séries mensuelles. */
  monthlyMode: MonthlyMode;
  /** Le dernier jour admis, quand la série en a un. */
  until: Date | null;
};

const JOURS = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });

const RANGS = ["premier", "deuxième", "troisième", "quatrième", "dernier"] as const;

/** Le nombre de jours d'un mois. `Date.UTC(année, mois, 0)` désigne le dernier
 *  jour du mois précédent : avec `mois` en base 1, c'est le mois demandé. */
function joursDansLeMois(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Le jour de la semaine d'une date civile, de 0 (dimanche) à 6. */
function jourDeSemaine(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Le rang du jour dans son mois : 3 pour le troisième samedi. Un cinquième
 *  samedi devient « le dernier » — c'est ce que la personne veut dire, et
 *  attendre un cinquième samedi sauterait la plupart des mois. */
function rangDansLeMois(day: number): number {
  return Math.min(Math.ceil(day / 7), 5);
}

/** Le quantième du `rang`-ième `jour` du mois, ou `null` si ce mois n'en a pas.
 *  Le rang 5 vaut « le dernier ». */
function quantiemeDuRang(
  year: number,
  month: number,
  jour: number,
  rang: number,
): number | null {
  const premier = jourDeSemaine(year, month, 1);
  const premierJour = 1 + ((jour - premier + 7) % 7);
  const fin = joursDansLeMois(year, month);

  if (rang >= 5) {
    let dernier = premierJour;
    while (dernier + 7 <= fin) dernier += 7;
    return dernier;
  }

  const quantieme = premierJour + (rang - 1) * 7;
  return quantieme <= fin ? quantieme : null;
}

/** Les dates que la règle produit, au plus `combien`.
 *
 *  `ancre` **porte la règle** : son heure, son jour de la semaine, son rang
 *  dans le mois, son quantième. `apres` ne dit que d'où reprendre. Les deux
 *  sont distincts parce qu'une série se prolonge : relire la règle sur la
 *  dernière séance écrite la ferait dériver — « le dernier samedi » deviendrait
 *  « le quatrième » dès qu'un mois n'en compte que quatre.
 *
 *  Un mois qui n'a pas la date voulue — le 31 février, un cinquième samedi
 *  absent — est sauté, jamais rabattu sur une date voisine : une veillée du 31
 *  ne se tient pas le 28. */
export function prochainesSeances(
  ancre: Date,
  rule: SeriesRule,
  combien: number,
  apres: Date = ancre,
): Date[] {
  const civil = gameCivil(ancre);
  const dates: Date[] = [];
  if (combien <= 0) return dates;

  const jour = jourDeSemaine(civil.year, civil.month, civil.day);
  const rang = rangDansLeMois(civil.day);

  // Reprendre à un (1) pour une série neuve ; sinon sauter d'emblée les pas
  // déjà écrits, plutôt que de les parcourir un à un.
  let premierPas = 1;
  if (apres.getTime() > ancre.getTime()) {
    const depuis = gameCivil(apres);
    premierPas =
      rule.recurrence === "hebdomadaire"
        ? Math.floor(
            (Date.UTC(depuis.year, depuis.month - 1, depuis.day) -
              Date.UTC(civil.year, civil.month - 1, civil.day)) /
              (7 * 86_400_000),
          )
        : (depuis.year - civil.year) * 12 + (depuis.month - civil.month);
    premierPas = Math.max(1, premierPas);
  }

  // Une borne de sécurité : une règle mensuelle peut sauter des mois, et la
  // boucle ne doit pas chercher indéfiniment une date qu'aucun mois ne porte.
  const essaisMax = rule.recurrence === "hebdomadaire" ? combien + 2 : combien * 12 + 24;

  for (let pas = premierPas; pas < premierPas + essaisMax && dates.length < combien; pas += 1) {
    let year = civil.year;
    let month = civil.month;
    let day: number | null;

    if (rule.recurrence === "hebdomadaire") {
      const avance = new Date(Date.UTC(civil.year, civil.month - 1, civil.day + 7 * pas));
      year = avance.getUTCFullYear();
      month = avance.getUTCMonth() + 1;
      day = avance.getUTCDate();
    } else {
      const total = civil.month - 1 + pas;
      year = civil.year + Math.floor(total / 12);
      month = (total % 12) + 1;
      day =
        rule.monthlyMode === "quantieme"
          ? civil.day <= joursDansLeMois(year, month)
            ? civil.day
            : null
          : quantiemeDuRang(year, month, jour, rang);
    }

    if (day === null) continue;

    const date = fromGameCivil(year, month, day, civil.hour, civil.minute);
    if (rule.until && date.getTime() > rule.until.getTime()) break;
    // Le pas calculé peut retomber sur une séance déjà écrite : on l'ignore.
    if (date.getTime() <= apres.getTime()) continue;
    dates.push(date);
  }

  return dates;
}

/** « Chaque mois, le troisième samedi à 21h00 » — ce que la série promet,
 *  en une ligne, à partir de la première séance. */
export function decrireSerie(depuis: Date, rule: SeriesRule): string {
  const civil = gameCivil(depuis);
  const jour = jourDeSemaine(civil.year, civil.month, civil.day);
  const nomDuJour = JOURS.format(new Date(Date.UTC(2024, 0, 7 + jour)));
  const heure = `${String(civil.hour).padStart(2, "0")}h${String(civil.minute).padStart(2, "0")}`;

  if (rule.recurrence === "hebdomadaire") {
    return `Chaque semaine, le ${nomDuJour} à ${heure}`;
  }
  if (rule.monthlyMode === "quantieme") {
    const quantieme = civil.day === 1 ? "1er" : String(civil.day);
    return `Chaque mois, le ${quantieme} à ${heure}`;
  }
  return `Chaque mois, le ${RANGS[rangDansLeMois(civil.day) - 1]} ${nomDuJour} à ${heure}`;
}

/** Les deux façons de répéter un mois, nommées pour la date choisie : c'est le
 *  seul endroit où l'ambiguïté « le 17 » / « le troisième samedi » se tranche,
 *  et elle se tranche à l'écran, pas en silence. */
export function choixMensuels(depuis: Date): Record<MonthlyMode, string> {
  const civil = gameCivil(depuis);
  const jour = jourDeSemaine(civil.year, civil.month, civil.day);
  const nomDuJour = JOURS.format(new Date(Date.UTC(2024, 0, 7 + jour)));
  const quantieme = civil.day === 1 ? "1er" : String(civil.day);
  return {
    quantieme: `Le ${quantieme} de chaque mois`,
    "rang-jour": `Le ${RANGS[rangDansLeMois(civil.day) - 1]} ${nomDuJour} du mois`,
  };
}
