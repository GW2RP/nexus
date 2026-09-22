import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import {
  ARROW_DASHES,
  ARROW_HEADS,
  ARROW_WIDTHS,
  BOARD_HEIGHT,
  BOARD_OWNERS,
  BOARD_VISIBILITIES,
  BOARD_WIDTH,
  ELEMENT_KINDS,
  ELEMENT_MAX,
  ELEMENT_MIN,
  TEXT_MAX,
} from "@/lib/boards";

/** Un élément posé sur le panneau. Son `_id` vient de l'éditeur, qui le dessine
 *  avant que le serveur l'ait reçu ; son auteur, lui, vient de la session. */
const elementSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ELEMENT_KINDS, required: true },
    x: { type: Number, required: true, min: 0, max: BOARD_WIDTH },
    y: { type: Number, required: true, min: 0, max: BOARD_HEIGHT },
    w: { type: Number, required: true, min: ELEMENT_MIN, max: ELEMENT_MAX },
    h: { type: Number, required: true, min: ELEMENT_MIN, max: ELEMENT_MAX },
    /** L'ordre d'empilement : le plus grand passe devant. */
    z: { type: Number, required: true, default: 0 },
    /** Du markdown pour une note ou un bloc de texte, une légende pour une forme. */
    text: { type: String, default: "", maxlength: TEXT_MAX },
    size: { type: Number, required: true },
    stroke: { type: String, required: true },
    fill: { type: String, required: true },
    ink: { type: String, required: true },
    authorId: { type: String, required: true },
    /** Masqué par la modération : il ne s'affiche plus, mais reste consultable
     *  en base le temps que la décision soit contestée. */
    hidden: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const arrowSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, required: true },
    from: { type: Schema.Types.ObjectId, required: true },
    to: { type: Schema.Types.ObjectId, required: true },
    color: { type: String, required: true },
    heads: { type: String, enum: ARROW_HEADS, required: true },
    dash: { type: String, enum: ARROW_DASHES, required: true },
    width: { type: String, enum: ARROW_WIDTHS, required: true },
    label: { type: String, default: "", maxlength: 80 },
    authorId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/** Un panneau d'affichage : celui d'un groupe — il en porte plusieurs, publics
 *  ou réservés à ses membres —, ou celui d'un lieu, public et unique.
 *
 *  Les éléments vivent sur le document : un panneau en compte des dizaines, et
 *  chaque écriture n'en touche qu'un, par son identifiant. Ce qu'on retire part
 *  à la corbeille (`removed`), bornée, pour que « annuler » puisse le rétablir
 *  avec son auteur plutôt que de le reposer au nom de celui qui annule. */
const boardSchema = new Schema(
  {
    ownerType: { type: String, enum: BOARD_OWNERS, required: true },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", index: true },
    placeId: { type: Schema.Types.ObjectId, ref: "Place" },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    /** Un panneau de lieu est toujours public. */
    visibility: { type: String, enum: BOARD_VISIBILITIES, required: true },
    /** Qui a ouvert le panneau. Ce n'est pas lui qui le mène : c'est le meneur
     *  du groupe, ou l'équipe du lieu. */
    authorId: { type: String, required: true },
    elements: { type: [elementSchema], default: [] },
    arrows: { type: [arrowSchema], default: [] },
    removed: { type: [elementSchema], default: [] },
    removedArrows: { type: [arrowSchema], default: [] },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false },
);

// Un lieu ne porte qu'un panneau. L'index est partiel et non `sparse` : les
// panneaux de groupe n'ont pas de `placeId`, et c'est l'absence du champ, pas
// sa nullité, qui doit les laisser hors de l'unicité.
boardSchema.index(
  { placeId: 1 },
  { unique: true, partialFilterExpression: { placeId: { $type: "objectId" } } },
);

export type BoardDocument = InferSchemaType<typeof boardSchema>;

export const Board: Model<BoardDocument> =
  (models.Board as Model<BoardDocument>) ?? model<BoardDocument>("Board", boardSchema);
