import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { EVENT_TYPES, EVENT_VISIBILITIES, REGIONS } from "@/lib/domain";

/** Une annonce d'évènement. Les heures sont celles du serveur de jeu et sont
 *  stockées en UTC ; l'affichage précise toujours le fuseau. */
const eventSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, enum: EVENT_TYPES, required: true, index: true },
    summary: { type: String, trim: true, maxlength: 300 },
    description: { type: String, maxlength: 20000 },
    practicalNotes: [{ type: String, maxlength: 400 }],
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date },
    placeId: { type: Schema.Types.ObjectId, ref: "Place", index: true },
    // Un évènement peut se tenir hors d'un lieu du registre : « point libre sur la carte ».
    freeLocationLabel: { type: String, trim: true, maxlength: 160 },
    region: { type: String, enum: REGIONS, index: true },
    coordinates: {
      x: { type: Number },
      y: { type: Number },
    },
    capacity: { type: Number, min: 0 },
    bannerUrl: { type: String },
    bannerAlt: { type: String, maxlength: 240 },
    organiserCharacterId: { type: Schema.Types.ObjectId, ref: "Character" },
    authorId: { type: String, required: true, index: true },
    /** Qui peut voir la scène. Une scène privée quitte l'agenda, la carte et
     *  le plan du site : elle ne se rejoint que par son lien de partage, par
     *  une invitation nominative, ou par le groupe qui lui est associé. */
    visibility: { type: String, enum: EVENT_VISIBILITIES, default: "publique", index: true },
    /** Le code du lien de partage. Il **est** l'adresse — `/invitation/<code>` —
     *  donc il n'est écrit que pour une scène privée, et le changer ferme
     *  l'ancien lien sans toucher aux inscriptions déjà prises.
     *  L'index unique est défini plus bas : il ne porte que sur les documents
     *  dont le code est une chaîne. Un index `sparse` ne suffirait pas — il
     *  ignore le champ absent, mais indexe le champ mis à `null`, et deux
     *  scènes redevenues publiques se heurteraient. */
    shareCode: { type: String },
    /** Les comptes invités nommément. */
    invitedUserIds: { type: [String], default: [], index: true },
    /** Le groupe dont les membres voient la scène et peuvent la rejoindre. */
    groupId: { type: Schema.Types.ObjectId, ref: "Group", index: true },
    /** La série dont cette scène est une séance, quand elle en fait partie. */
    seriesId: { type: Schema.Types.ObjectId, ref: "EventSeries", index: true },
    /** Le rang de la séance dans sa série, à partir de 1. Il ordonne et nomme
     *  les séances sans dépendre de leur date, qu'une modification peut bouger. */
    occurrenceIndex: { type: Number },
    /** La série est en pause : recopié sur chaque séance pour que l'agenda
     *  filtre en une passe. Une seule écriture le pose et le retire — celle qui
     *  met la série en pause ou la reprend. Sans lui, lister l'agenda
     *  demanderait de charger les séries de toutes les séances rencontrées,
     *  puis de filtrer après coup, ce qui fausserait la limite. */
    seriesPausedAt: { type: Date },
    /** La séance a été retirée de la série. Elle quitte l'agenda et la carte,
     *  garde ses inscrits, et se rétablit. */
    cancelledAt: { type: Date },
    /** Épinglé sur la carte par un conteur. */
    pinned: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

eventSchema.index({ title: "text", summary: "text" });
eventSchema.index(
  { shareCode: 1 },
  { unique: true, partialFilterExpression: { shareCode: { $type: "string" } } },
);

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDocument> =
  (models.Event as Model<EventDocument>) ?? model<EventDocument>("Event", eventSchema);
