import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { REGIONS } from "@/lib/domain";

/** Une rumeur peut être fausse : c'est le but. Elle est le plus souvent dite par
 *  un personnage, mais elle peut aussi n'avoir aucune source — on l'attribue
 *  alors au compte qui l'a colportée le premier. */
const rumorSchema = new Schema(
  {
    body: { type: String, required: true, trim: true, maxlength: 600 },
    characterId: { type: Schema.Types.ObjectId, ref: "Character", index: true },
    placeId: { type: Schema.Types.ObjectId, ref: "Place" },
    /** Lieu d'écoute libre quand ce n'est pas un lieu du registre. */
    heardAtLabel: { type: String, trim: true, maxlength: 160 },
    region: { type: String, enum: REGIONS, index: true },
    /** Les comptes qui ont repris la rumeur ; le compteur en découle. */
    echoedBy: [{ type: String }],
    echoCount: { type: Number, default: 0, index: true },
    authorId: { type: String, required: true, index: true },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

export type RumorDocument = InferSchemaType<typeof rumorSchema>;

export const Rumor: Model<RumorDocument> =
  (models.Rumor as Model<RumorDocument>) ?? model<RumorDocument>("Rumor", rumorSchema);
