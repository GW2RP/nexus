import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { GROUP_VISIBILITIES } from "@/lib/domain";

/** Un groupe : un cercle de comptes, mené par celui qui l'a fondé.
 *
 *  `visibility` dit qui **voit** le groupe, pas qui peut y entrer : dans les
 *  deux cas, c'est le meneur qui ajoute les membres. Un groupe public se lit
 *  depuis la page des groupes ; un groupe privé n'apparaît que pour les siens.
 *
 *  Les membres sont une liste d'identifiants de compte sur le document, comme
 *  les co-gérants d'un lieu : un cercle se compte par dizaines, pas par
 *  milliers, et une collection de liaison coûterait une jointure à chaque
 *  lecture d'agenda. */
const groupSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    visibility: { type: String, enum: GROUP_VISIBILITIES, required: true, index: true },
    summary: { type: String, trim: true, maxlength: 400 },
    description: { type: String, maxlength: 20000 },
    bannerUrl: { type: String },
    bannerAlt: { type: String, maxlength: 240 },
    /** Le meneur : celui qui a fondé le groupe. */
    authorId: { type: String, required: true, index: true },
    /** Les comptes du cercle, le meneur exclu — il en est membre de droit. */
    memberIds: { type: [String], default: [], index: true },
    hidden: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, versionKey: false },
);

groupSchema.index({ name: "text", summary: "text" });

export type GroupDocument = InferSchemaType<typeof groupSchema>;

export const Group: Model<GroupDocument> =
  (models.Group as Model<GroupDocument>) ?? model<GroupDocument>("Group", groupSchema);
