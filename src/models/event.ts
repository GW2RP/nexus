import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { EVENT_TYPES, REGIONS } from "@/lib/domain";

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
    /** Épinglé sur la carte par un conteur. */
    pinned: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

eventSchema.index({ title: "text", summary: "text" });

export type EventDocument = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDocument> =
  (models.Event as Model<EventDocument>) ?? model<EventDocument>("Event", eventSchema);
