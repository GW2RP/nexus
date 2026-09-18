import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { GENDERS, RACES } from "@/lib/domain";

/** Une fiche de personnage du registre. L'âge est en années pour toutes les races. */
const characterSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    race: { type: String, enum: RACES, required: true, index: true },
    gender: { type: String, enum: GENDERS, default: "neutre" },
    age: { type: Number, min: 0, max: 900 },
    title: { type: String, trim: true, maxlength: 120 },
    tagline: { type: String, trim: true, maxlength: 240 },
    summary: { type: String, trim: true, maxlength: 600 },
    story: { type: String, maxlength: 20000 },
    appearance: { type: String, maxlength: 8000 },
    homeRegion: { type: String, index: true },
    homePlaceLabel: { type: String, trim: true, maxlength: 120 },
    birthplace: { type: String, trim: true, maxlength: 120 },
    occupation: { type: String, trim: true, maxlength: 120 },
    status: { type: String, trim: true, maxlength: 120 },
    birthDate: { type: String, trim: true, maxlength: 60 },
    portraitUrl: { type: String },
    portraitAlt: { type: String, maxlength: 240 },
    hauntsPlaceIds: [{ type: Schema.Types.ObjectId, ref: "Place" }],
    authorId: { type: String, required: true, index: true },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

characterSchema.index({ name: "text", summary: "text", title: "text" });

export type CharacterDocument = InferSchemaType<typeof characterSchema>;

export const Character: Model<CharacterDocument> =
  (models.Character as Model<CharacterDocument>) ??
  model<CharacterDocument>("Character", characterSchema);
