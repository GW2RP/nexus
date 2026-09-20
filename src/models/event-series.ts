import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { MONTHLY_MODES, RECURRENCES } from "@/lib/domain";

/** La règle d'une série de scènes.
 *
 *  Les séances, elles, sont des évènements à part entière : chacune porte ses
 *  inscriptions, son pin de carte et son adresse. Ce document ne tient que ce
 *  qui vaut pour toutes — la cadence, la fin, la pause — et jusqu'où on est
 *  allé dans l'écriture.
 *
 *  Une série sans fin n'écrit pas l'éternité : elle écrit un lot, et se
 *  prolonge depuis la page des séances. Cinquante-deux annonces pour une
 *  veillée hebdomadaire rempliraient l'agenda d'un an de scènes que personne
 *  n'a encore promises. */
const eventSeriesSchema = new Schema(
  {
    recurrence: {
      type: String,
      enum: RECURRENCES.filter((value) => value !== "aucune"),
      required: true,
    },
    /** « Le 17 » ou « le troisième samedi » : deux séries différentes qui
     *  partent du même jour. Sans objet pour une série hebdomadaire. */
    monthlyMode: { type: String, enum: MONTHLY_MODES, default: "quantieme" },
    /** Le début de la première séance : il porte l'heure et le jour de la règle. */
    anchorAt: { type: Date, required: true },
    /** Le dernier jour admis, quand la série s'arrête à une date. */
    until: { type: Date },
    /** Le nombre de séances promis, quand la série s'arrête après un compte.
     *  Il est écrit, et non déduit de ce qui a déjà été produit : sans lui, une
     *  série annoncée « après douze séances » se prolongerait au-delà, et
     *  l'écran promettrait une chose pendant que la règle en permettrait une
     *  autre. */
    maxOccurrences: { type: Number },
    /** La série est en pause depuis cet instant. Ses séances à venir quittent
     *  l'agenda sans perdre leurs inscrits, et y reviennent à la reprise. */
    pausedAt: { type: Date },
    /** Le début de la dernière séance écrite : le prolongement repart de là. */
    lastOccurrenceAt: { type: Date, required: true },
    /** Combien de séances la série a écrites, annulées comprises. C'est ce que
     *  la borne dure compte : sans lui, prolonger indéfiniment une série
     *  suffirait à remplir la base. */
    occurrenceCount: { type: Number, default: 0 },
    authorId: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

export type EventSeriesDocument = InferSchemaType<typeof eventSeriesSchema>;

export const EventSeries: Model<EventSeriesDocument> =
  (models.EventSeries as Model<EventSeriesDocument>) ??
  model<EventSeriesDocument>("EventSeries", eventSeriesSchema);
