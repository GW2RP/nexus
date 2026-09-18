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

export const PLACE_TYPES = ["taverne", "guilde", "ruine", "commerce"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  taverne: "Taverne",
  guilde: "Siège de guilde",
  ruine: "Ruine",
  commerce: "Commerce",
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

export const REPORT_TARGETS = ["rumeur", "personnage", "lieu", "evenement"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  rumeur: "Rumeur",
  personnage: "Personnage",
  lieu: "Lieu",
  evenement: "Évènement",
};

/** Où mène le contenu signalé, une fois qu'on connaît son type et son identifiant public. */
export const REPORT_TARGET_PATHS: Record<ReportTarget, (slug: string) => string> = {
  rumeur: () => "/rumeurs",
  personnage: (slug) => `/personnages/${slug}`,
  lieu: (slug) => `/lieux/${slug}`,
  evenement: (slug) => `/evenements/${slug}`,
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
