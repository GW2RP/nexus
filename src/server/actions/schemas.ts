import { z } from "zod";

import { fromGameInput } from "@/lib/dates";
import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import {
  EVENT_TYPES,
  EVENT_VISIBILITIES,
  GENDERS,
  GROUP_VISIBILITIES,
  MONTHLY_MODES,
  PLACE_TYPES,
  RACES,
  RECURRENCES,
  REGIONS,
  REPORT_REASONS,
  REPORT_TARGETS,
  TERRAINS,
} from "@/lib/domain";

/** Un formulaire HTML envoie « » pour un champ vidé et pour une option « aucun ».
 *  Les aides ci-dessous ramènent ces vides à `null`, ce qui permet à l'auteur
 *  d'effacer un champ qu'il avait rempli — `undefined` le laisserait en place. */

const emptyToNull = (value: unknown) => (typeof value === "string" && value.trim() === "" ? null : value);

const trimmed = (max: number) => z.string().trim().max(max);

const optionalText = (max: number) =>
  z.preprocess(emptyToNull, z.string().trim().max(max).nullable().optional());

const optionalUrl = (message: string) =>
  z.preprocess(emptyToNull, z.string().trim().url(message).nullable().optional());

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToNull, z.enum(values).nullable().optional());

/** Une image sans alternative textuelle rend la fiche illisible à qui ne la voit
 *  pas. Le formulaire l'exige déjà ; sans cette règle, une soumission qui
 *  contourne le navigateur passerait quand même. */
const ALT_REQUIRED = "Une image demande son alternative textuelle.";

function altAccompaniesImage<T extends Record<string, unknown>>(
  urlKey: keyof T & string,
  altKey: keyof T & string,
) {
  return {
    check: (value: T) => {
      const url = value[urlKey];
      const alt = value[altKey];
      if (!url || typeof url !== "string") return true;
      return typeof alt === "string" && alt.trim().length > 0;
    },
    options: { message: ALT_REQUIRED, path: [altKey] },
  };
}

/** Une liste d'identifiants cochés dans un formulaire. Le champ s'appelle
 *  « nom[] » : `parseForm` en fait un tableau, et son absence — aucune case
 *  cochée — doit valoir liste vide, sinon on ne peut plus tout décocher. */
const idList = (max: number, message: string) =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return [];
      return Array.isArray(value) ? value : [value];
    },
    z.array(trimmed(40).min(1)).max(max, message),
  );

/** Les champs de date lisent l'horloge du serveur de jeu, celle que le
 *  formulaire annonce — pas celle du serveur qui reçoit le formulaire.
 *  `fromGameInput` porte la règle ; la récurrence la rend visible : une veillée
 *  tapée samedi 23h00 deviendrait « le troisième dimanche » sans elle. */
const lireHeureDeJeu = (value: unknown) =>
  typeof value === "string" ? (fromGameInput(value) ?? value) : value;

const gameDate = (message: string) => z.preprocess(lireHeureDeJeu, z.coerce.date({ message }));

const optionalGameDate = () =>
  z.preprocess(
    (value) => lireHeureDeJeu(emptyToNull(value)),
    z.coerce.date().nullable().optional(),
  );

const optionalInteger = (min: number, max: number, message?: string) =>
  z.preprocess(
    emptyToNull,
    z.coerce.number().int(message ?? "Ce champ attend un nombre entier.").min(min).max(max).nullable().optional(),
  );

const characterFields = z.object({
  name: trimmed(80).min(2, "Le nom fait au moins deux caractères."),
  race: z.enum(RACES),
  gender: z.enum(GENDERS).default("neutre"),
  age: optionalInteger(0, 900, "L'âge s'écrit en années entières."),
  title: optionalText(120),
  tagline: optionalText(240),
  summary: optionalText(600),
  story: optionalText(20000),
  appearance: optionalText(8000),
  homeRegion: optionalEnum(REGIONS),
  homePlaceLabel: optionalText(120),
  birthplace: optionalText(120),
  birthDate: optionalText(60),
  occupation: optionalText(120),
  status: optionalText(120),
  portraitUrl: optionalUrl("L'adresse du portrait doit être une URL."),
  portraitAlt: optionalText(240),
});

const characterAlt = altAccompaniesImage<z.infer<typeof characterFields>>(
  "portraitUrl",
  "portraitAlt",
);
export const characterSchema = characterFields.refine(
  characterAlt.check,
  characterAlt.options,
);

const placeFields = z.object({
  name: trimmed(120).min(2, "Le nom fait au moins deux caractères."),
  type: z.enum(PLACE_TYPES),
  region: z.enum(REGIONS),
  district: optionalText(120),
  access: optionalText(120),
  summary: optionalText(400),
  description: optionalText(20000),
  bannerUrl: optionalUrl("L'adresse de la bannière doit être une URL."),
  bannerAlt: optionalText(240),
  coordinateX: optionalInteger(0, CONTINENT_WIDTH),
  coordinateY: optionalInteger(0, CONTINENT_HEIGHT),
  keeperCharacterIds: idList(8, "Un lieu ne se tient pas à plus de huit."),
  managerIds: idList(8, "Un lieu ne se gère pas à plus de huit."),
});

const placeAlt = altAccompaniesImage<z.infer<typeof placeFields>>("bannerUrl", "bannerAlt");
export const placeSchema = placeFields.refine(placeAlt.check, placeAlt.options);

export const eventSchema = z
  .object({
    title: trimmed(140).min(3, "Le titre fait au moins trois caractères."),
    type: z.enum(EVENT_TYPES),
    summary: optionalText(300),
    description: optionalText(20000),
    startsAt: gameDate("La date de début est attendue."),
    endsAt: optionalGameDate(),
    placeId: optionalText(40),
    freeLocationLabel: optionalText(160),
    // Une scène hors du registre se pose sur la carte comme un lieu. Quand elle
    // se tient dans un lieu du registre, le point vient de lui.
    coordinateX: optionalInteger(0, CONTINENT_WIDTH),
    coordinateY: optionalInteger(0, CONTINENT_HEIGHT),
    region: optionalEnum(REGIONS),
    capacity: optionalInteger(0, 999),
    bannerUrl: optionalUrl("L'adresse de la bannière doit être une URL."),
    bannerAlt: optionalText(240),
    organiserCharacterId: optionalText(40),
    practicalNotes: optionalText(2000),
    /** Publique ou privée. Une scène privée quitte l'agenda et reçoit un code. */
    visibility: z.enum(EVENT_VISIBILITIES).default("publique"),
    /** Le groupe dont les membres la voient. L'action vérifie qu'on le mène. */
    groupId: optionalText(40),
    invitedUserIds: idList(30, "Une scène ne s'ouvre pas à plus de trente invités."),
    recurrence: z.enum(RECURRENCES).default("aucune"),
    monthlyMode: z.enum(MONTHLY_MODES).default("quantieme"),
    seriesEnd: z.enum(["sans-fin", "compte", "date"]).default("sans-fin"),
    seriesCount: optionalInteger(2, 60, "Le nombre de séances s'écrit en entier."),
    seriesUntil: optionalGameDate(),
  })
  .refine((value) => value.placeId || value.freeLocationLabel, {
    message: "Choisissez un lieu du registre, ou décrivez un point libre sur la carte.",
    path: ["placeId"],
  })
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    message: "La fin vient après le début.",
    path: ["endsAt"],
  })
  .refine((value) => !value.bannerUrl || Boolean(value.bannerAlt?.trim()), {
    message: ALT_REQUIRED,
    path: ["bannerAlt"],
  })
  // Une fin par date sans date, ou par nombre sans nombre, ne dit rien : le
  // formulaire le demande déjà, et une soumission qui le contourne aussi.
  .refine(
    (value) => value.recurrence === "aucune" || value.seriesEnd !== "date" || Boolean(value.seriesUntil),
    { message: "Donnez le dernier jour de la série.", path: ["seriesUntil"] },
  )
  .refine(
    (value) =>
      value.recurrence === "aucune" ||
      value.seriesEnd !== "date" ||
      !value.seriesUntil ||
      value.seriesUntil > value.startsAt,
    { message: "La fin de la série vient après sa première séance.", path: ["seriesUntil"] },
  )
  .refine(
    (value) => value.recurrence === "aucune" || value.seriesEnd !== "compte" || Boolean(value.seriesCount),
    { message: "Donnez le nombre de séances.", path: ["seriesCount"] },
  );

const groupFields = z.object({
  name: trimmed(120).min(2, "Le nom fait au moins deux caractères."),
  visibility: z.enum(GROUP_VISIBILITIES),
  summary: optionalText(400),
  description: optionalText(20000),
  bannerUrl: optionalUrl("L'adresse de la bannière doit être une URL."),
  bannerAlt: optionalText(240),
  memberIds: idList(100, "Un groupe ne compte pas plus de cent membres."),
});

const groupAlt = altAccompaniesImage<z.infer<typeof groupFields>>("bannerUrl", "bannerAlt");
export const groupSchema = groupFields.refine(groupAlt.check, groupAlt.options);

export const rumorSchema = z.object({
  body: trimmed(600).min(20, "Une rumeur tient en au moins vingt caractères."),
  // Une rumeur peut n'avoir aucune source : elle est alors signée par le compte.
  characterId: optionalText(40),
  placeId: optionalText(40),
  heardAtLabel: optionalText(160),
  region: optionalEnum(REGIONS),
  // Le point est facultatif : une rumeur court la Tyrie sans forcément avoir un
  // endroit à elle. Quand elle en a un, il se pose sur la carte.
  coordinateX: optionalInteger(0, CONTINENT_WIDTH),
  coordinateY: optionalInteger(0, CONTINENT_HEIGHT),
});

/** Un sommet du tracé, borné par le continent lui-même. */
const vertexSchema = z.object({
  x: z.number().int().min(0).max(CONTINENT_WIDTH),
  y: z.number().int().min(0).max(CONTINENT_HEIGHT),
});

/** Le tracé arrive en une seule chaîne JSON : le nombre de sommets est variable,
 *  et deux champs par sommet ne se nomment pas. Un JSON illisible doit dire
 *  pourquoi en français plutôt que de remonter une erreur de moteur. */
const drawnPolygon = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}, z.array(vertexSchema, { message: "Le tracé de la zone est illisible." })
  .min(3, "Une zone demande au moins trois sommets.")
  .max(120, "Une zone ne dépasse pas cent vingt sommets."));

export const terrainZoneSchema = z.object({
  name: trimmed(80).min(2, "Le nom fait au moins deux caractères."),
  terrain: z.enum(TERRAINS),
  region: optionalEnum(REGIONS),
  altitude: z.coerce.number().int().min(0).max(100).default(0),
  points: drawnPolygon,
});

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: trimmed(40).min(1),
  targetSlug: optionalText(120),
  reason: z.enum(REPORT_REASONS),
  comment: optionalText(2000),
});

export const resolveReportSchema = z.object({
  reportId: trimmed(40).min(1),
  decision: z.enum(["supprimer", "avertir", "suspendre", "rejeter", "masquer"]),
  reason: trimmed(2000).min(10, "Le motif est inscrit au journal : dites-le en une phrase."),
  notifyAuthor: z
    .preprocess(emptyToNull, z.literal("on").nullable().optional())
    .transform((value) => value === "on"),
});
