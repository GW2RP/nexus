import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { PLACE_TYPES, REGIONS } from "@/lib/domain";

/** Un point numéroté du plan intérieur, en coordonnées pixel de l'image téléversée. */
const floorPointSchema = new Schema(
  {
    number: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, maxlength: 80 },
    description: { type: String, maxlength: 400 },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

/** Une fiche de lieu : son emplacement en Tyrie et, si l'auteur en pose un, son plan. */
const placeSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: { type: String, enum: PLACE_TYPES, required: true, index: true },
    region: { type: String, enum: REGIONS, required: true, index: true },
    district: { type: String, trim: true, maxlength: 120 },
    access: { type: String, trim: true, maxlength: 120, default: "Ouvert à tous" },
    summary: { type: String, trim: true, maxlength: 400 },
    description: { type: String, maxlength: 20000 },
    bannerUrl: { type: String },
    bannerAlt: { type: String, maxlength: 240 },
    logoUrl: { type: String },
    // Coordonnées sur la carte du jeu, en CRS.Simple : [x, y] en unités de tuile.
    coordinates: {
      x: { type: Number },
      y: { type: Number },
    },
    floorPlan: {
      imageUrl: { type: String },
      imageAlt: { type: String, maxlength: 240 },
      width: { type: Number },
      height: { type: Number },
      points: [floorPointSchema],
    },
    // Un lieu peut être tenu par plusieurs personnages — une taverne a son
    // patron et sa serveuse. `keeperCharacterId` est l'ancien champ, au
    // singulier : il est encore lu pour les fiches écrites avant, jamais écrit.
    keeperCharacterIds: [{ type: Schema.Types.ObjectId, ref: "Character" }],
    keeperCharacterId: { type: Schema.Types.ObjectId, ref: "Character" },
    authorId: { type: String, required: true, index: true },
    /** Les comptes qui peuvent modifier le lieu avec son auteur. */
    managerIds: { type: [String], default: [], index: true },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

placeSchema.index({ name: "text", summary: "text" });

export type PlaceDocument = InferSchemaType<typeof placeSchema>;

export const Place: Model<PlaceDocument> =
  (models.Place as Model<PlaceDocument>) ?? model<PlaceDocument>("Place", placeSchema);
