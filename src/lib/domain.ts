/** Le vocabulaire du hub : races, types, régions, motifs, rôles.
 *  Une seule source pour les libellés affichés et les valeurs stockées. */

export const ROLES = ["membre", "conteur", "administration"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  membre: "Membre",
  conteur: "Conteur",
  administration: "Administration",
};

export const RACES = ["humain", "charr", "norn", "asura", "sylvari"] as const;
export type Race = (typeof RACES)[number];

/** Les races s'accordent : la puce d'une fiche reprend le genre du personnage. */
export const RACE_LABELS: Record<Race, { neutre: string; feminin: string; masculin: string }> = {
  humain: { neutre: "Humain", feminin: "Humaine", masculin: "Humain" },
  charr: { neutre: "Charr", feminin: "Charr", masculin: "Charr" },
  norn: { neutre: "Norn", feminin: "Norn", masculin: "Norn" },
  asura: { neutre: "Asura", feminin: "Asura", masculin: "Asura" },
  sylvari: { neutre: "Sylvari", feminin: "Sylvari", masculin: "Sylvari" },
};

export const GENDERS = ["feminin", "masculin", "neutre"] as const;
export type Gender = (typeof GENDERS)[number];

export function raceLabel(race: Race, gender: Gender = "neutre"): string {
  return RACE_LABELS[race][gender];
}

export const EVENT_TYPES = ["taverne", "aventure", "commerce", "ceremonie", "intrigue"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  taverne: "Taverne",
  aventure: "Aventure",
  commerce: "Commerce",
  ceremonie: "Cérémonie",
  intrigue: "Intrigue",
};

/** Qui peut voir une scène.
 *
 *  Deux états, pas trois : une scène privée porte toujours un code de partage,
 *  et le groupe comme les invités nominatifs s'y ajoutent. Un troisième état
 *  « réservée à un groupe » ne dirait rien de plus — il dirait seulement que la
 *  liste d'invités est vide. */
export const EVENT_VISIBILITIES = ["publique", "privee"] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, string> = {
  publique: "Publique",
  privee: "Privée",
};

/** La cadence d'une série. Une scène qui ne se répète pas n'a pas de série. */
export const RECURRENCES = ["aucune", "hebdomadaire", "mensuelle"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  aucune: "Ne se répète pas",
  hebdomadaire: "Chaque semaine",
  mensuelle: "Chaque mois",
};

/** « Le 17 de chaque mois » et « le troisième samedi du mois » sont deux séries
 *  différentes qui partent du même jour. Le choix revient à l'organisateur :
 *  rien dans la date de début ne permet de le deviner. */
export const MONTHLY_MODES = ["quantieme", "rang-jour"] as const;
export type MonthlyMode = (typeof MONTHLY_MODES)[number];

/** Qui voit un groupe. Dans les deux cas, c'est le meneur qui ajoute les
 *  membres : « public » dit qui voit le groupe, pas qui peut y entrer. */
export const GROUP_VISIBILITIES = ["public", "prive"] as const;
export type GroupVisibility = (typeof GROUP_VISIBILITIES)[number];

export const GROUP_VISIBILITY_LABELS: Record<GroupVisibility, string> = {
  public: "Public",
  prive: "Privé",
};

/** Les nouveaux types s'ajoutent **à la fin** : c'est l'ordre des puces de
 *  filtre et de la liste déroulante du formulaire, et le déplacer ferait bouger
 *  sous les doigts des repères déjà pris. Rien d'autre n'en dépend — un lieu
 *  range son type par son nom, pas par son rang, contrairement aux terrains. */
export const PLACE_TYPES = [
  "taverne",
  "guilde",
  "ruine",
  "commerce",
  "domaine",
  "maison",
  "campement",
] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  taverne: "Taverne",
  guilde: "Siège de guilde",
  ruine: "Ruine",
  commerce: "Commerce",
  domaine: "Domaine",
  maison: "Maison",
  campement: "Campement",
};

export const REGIONS = ["kryte", "ascalon", "maguuma", "shiverpeaks", "orr", "desert"] as const;
export type Region = (typeof REGIONS)[number];

export const REGION_LABELS: Record<Region, string> = {
  kryte: "Kryte",
  ascalon: "Ascalon",
  maguuma: "Maguuma",
  shiverpeaks: "Pics Glacés",
  orr: "Orr",
  desert: "Désert de Cristal",
};

export const WEATHER_CONDITIONS = [
  "degage",
  "nuages",
  "pluie-fine",
  "orage",
  "brume",
  "neige",
] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const WEATHER_LABELS: Record<WeatherCondition, string> = {
  degage: "Dégagé",
  nuages: "Nuages",
  "pluie-fine": "Pluie fine",
  orage: "Orage",
  brume: "Brume",
  neige: "Neige",
};

/** Les terrains que l'administration dessine sur la carte. Ils ne décorent pas :
 *  chacun tire la simulation dans un sens précis.
 *
 *  `plaine` est le terrain d'une cellule que personne n'a couverte, et c'est
 *  aussi un terrain qui se dessine : c'est ainsi qu'on donne sa géographie à une
 *  région sans lui inventer un caractère particulier. */
export const TERRAINS = [
  "mer",
  "marais",
  "relief",
  "foret",
  "aride",
  "plaine",
  // Les suivants s'ajoutent toujours à la fin : le rang dans ce tableau est
  // l'entier écrit dans les pas de simulation déjà stockés. Insérer au milieu
  // relirait tout l'historique de travers.
  "riviere",
  "lac",
  "volcan",
  "ville",
] as const;
export type Terrain = (typeof TERRAINS)[number];

export const TERRAIN_LABELS: Record<Terrain, string> = {
  mer: "Mer",
  marais: "Marais",
  relief: "Relief",
  foret: "Forêt",
  aride: "Terres arides",
  plaine: "Plaine",
  riviere: "Rivière",
  lac: "Lac",
  volcan: "Volcan",
  ville: "Ville",
};

export const REPORT_REASONS = [
  "propos-haineux",
  "harcelement",
  "hors-univers",
  "spam",
  "doublon",
  "image-inadaptee",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  "propos-haineux": "Propos haineux",
  harcelement: "Harcèlement",
  "hors-univers": "Hors univers",
  spam: "Spam",
  doublon: "Doublon",
  "image-inadaptee": "Image inadaptée",
};

export const REPORT_TARGETS = [
  "rumeur",
  "personnage",
  "lieu",
  "evenement",
  "element-panneau",
] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  rumeur: "Rumeur",
  personnage: "Personnage",
  lieu: "Lieu",
  evenement: "Évènement",
  "element-panneau": "Élément de panneau",
};

/** Où mène le contenu signalé, une fois qu'on connaît son type et son identifiant public. */
export const REPORT_TARGET_PATHS: Record<ReportTarget, (slug: string) => string> = {
  rumeur: () => "/rumeurs",
  personnage: (slug) => `/personnages/${slug}`,
  lieu: (slug) => `/lieux/${slug}`,
  evenement: (slug) => `/evenements/${slug}`,
  // L'élément n'a pas d'adresse à lui : on range le chemin de son panneau, qui
  // l'ouvre sélectionné.
  "element-panneau": (chemin) => chemin,
};

export const REPORT_STATUSES = ["en-attente", "traite", "rejete"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  "en-attente": "En attente",
  traite: "Traité",
  rejete: "Rejeté",
};

export const MODERATION_ACTIONS = [
  "supprimer",
  "avertir",
  "suspendre",
  "rejeter",
  "masquer",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const MODERATION_ACTION_LABELS: Record<ModerationAction, string> = {
  supprimer: "Suppression du contenu",
  avertir: "Avertissement de l'auteur",
  suspendre: "Suspension du compte",
  rejeter: "Signalement rejeté",
  masquer: "Contenu masqué",
};
