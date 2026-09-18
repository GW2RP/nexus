import { z } from "zod";

import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import {
  EVENT_TYPES,
  GENDERS,
  PLACE_TYPES,
  RACES,
  REGIONS,
  REPORT_REASONS,
  REPORT_TARGETS,
  WEATHER_CONDITIONS,
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
  keeperCharacterId: optionalText(40),
});

const placeAlt = altAccompaniesImage<z.infer<typeof placeFields>>("bannerUrl", "bannerAlt");
export const placeSchema = placeFields.refine(placeAlt.check, placeAlt.options);

export const eventSchema = z
  .object({
    title: trimmed(140).min(3, "Le titre fait au moins trois caractères."),
    type: z.enum(EVENT_TYPES),
    summary: optionalText(300),
    description: optionalText(20000),
    startsAt: z.coerce.date({ message: "La date de début est attendue." }),
    endsAt: z.preprocess(emptyToNull, z.coerce.date().nullable().optional()),
    placeId: optionalText(40),
    freeLocationLabel: optionalText(160),
    region: optionalEnum(REGIONS),
    capacity: optionalInteger(0, 999),
    bannerUrl: optionalUrl("L'adresse de la bannière doit être une URL."),
    bannerAlt: optionalText(240),
    organiserCharacterId: optionalText(40),
    practicalNotes: optionalText(2000),
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
  });

export const rumorSchema = z.object({
  body: trimmed(600).min(20, "Une rumeur tient en au moins vingt caractères."),
  // Une rumeur peut n'avoir aucune source : elle est alors signée par le compte.
  characterId: optionalText(40),
  placeId: optionalText(40),
  heardAtLabel: optionalText(160),
  region: optionalEnum(REGIONS),
});

export const weatherSchema = z
  .object({
    region: z.enum(REGIONS),
    condition: z.enum(WEATHER_CONDITIONS),
    intensity: z.coerce.number().int().min(0).max(100).default(50),
    startsAt: z.coerce.date({ message: "La date de début est attendue." }),
    endsAt: z.coerce.date({ message: "La date de fin est attendue." }),
    note: optionalText(240),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "La fin vient après le début.",
    path: ["endsAt"],
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
