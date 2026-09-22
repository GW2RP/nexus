import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { PLACE_TYPES, REGIONS } from "@/lib/domain";

/** Un point numéroté posé sur un plan, en pourcentage de l'image téléversée.
 *  En pourcentage et non en pixels : l'image se rend à la largeur de la colonne,
 *  jamais à sa taille d'origine, donc un pixel du fichier ne désigne rien à
 *  l'écran. Le numéro est celui de sa place dans la liste — il s'écrit au
 *  serveur, sinon deux points pourraient porter le même. */
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

/** Un plan du lieu : son image, son nom, et les points qu'on y a posés.
 *  Un lieu en porte plusieurs — le rez-de-chaussée, l'étage, la cave —, et
 *  chacun nomme son onglet sur la fiche : sans nom, une pile d'onglets ne dit
 *  pas lequel montre quoi. */
const floorPlanSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    // L'image est facultative : un plan peut n'être encore que sa liste de
    // points — c'est ce que portaient les fiches d'avant la liste, et la fiche
    // les montre alors sur un placeholder plutôt que d'oublier leurs légendes.
    imageUrl: { type: String },
    imageAlt: { type: String, maxlength: 240 },
    /** Les dimensions du fichier : le cadre les prend pour rapport avant que
     *  l'image arrive, sinon les points sautent à son chargement. */
    width: { type: Number },
    height: { type: Number },
    points: [floorPointSchema],
  },
  { _id: false },
);

/** Une fiche de lieu : son emplacement en Tyrie et, si l'auteur en pose, ses plans. */
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
    // La liste des plans. `floorPlan` est l'ancien champ, au singulier : il est
    // encore lu pour les fiches écrites avant, jamais écrit — un lieu qui
    // s'enregistre le range dans la liste et l'efface.
    floorPlans: { type: [floorPlanSchema], default: [] },
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
