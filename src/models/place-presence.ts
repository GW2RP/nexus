import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * « Je suis à ce lieu » : un compte déclare qu'il s'y tient, en ce moment,
 * sous l'un de ses personnages. D'où la fréquentation en direct du registre.
 *
 * **Un compte, un lieu à la fois** : on n'est pas à deux tavernes en même
 * temps, et se déclarer ailleurs déplace la présence. L'échéance (`until`)
 * s'écrit à la déclaration et **se juge à la lecture**, comme le statut d'un
 * lieu ; l'index d'expiration ne fait que le ménage, à son heure à lui.
 */
const placePresenceSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    placeId: { type: Schema.Types.ObjectId, ref: "Place", required: true, index: true },
    /** La fiche du personnage, quand il en a une sur le hub. */
    characterId: { type: Schema.Types.ObjectId, ref: "Character" },
    /** Le nom affiché : celui de la fiche, ou celui que le jeu donne à
     *  l'overlay pour un personnage qui n'a pas encore la sienne. */
    characterName: { type: String, trim: true, maxlength: 80 },
    /** L'overlay renouvelle sa déclaration tant qu'on reste près du lieu ;
     *  celle du site vit deux heures et ne suit pas la position. */
    source: { type: String, enum: ["overlay", "site"], required: true },
    since: { type: Date, required: true },
    until: { type: Date, required: true },
  },
  { versionKey: false },
);

placePresenceSchema.index({ until: 1 }, { expireAfterSeconds: 0 });

export type PlacePresenceDocument = InferSchemaType<typeof placePresenceSchema>;

export const PlacePresence: Model<PlacePresenceDocument> =
  (models.PlacePresence as Model<PlacePresenceDocument>) ??
  model<PlacePresenceDocument>("PlacePresence", placePresenceSchema);
