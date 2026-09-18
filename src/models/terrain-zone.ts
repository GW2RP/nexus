import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { REGIONS, TERRAINS } from "@/lib/domain";

/** Un sommet du tracé, en pixels de continent — le format que rend la carte. */
const vertexSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
  },
  { _id: false },
);

/** Une zone de terrain dessinée par l'administration. Elle ne décore pas la
 *  carte : c'est elle qui donne son terrain à chaque cellule de simulation, et
 *  c'est son champ `region` qui donne enfin une géographie aux six régions. */
const terrainZoneSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    terrain: { type: String, enum: TERRAINS, required: true, index: true },
    /** Facultative : une mer n'appartient à aucune région. Une cellule sans
     *  région n'entre dans aucun bulletin — elle n'est pas inventée. */
    region: { type: String, enum: REGIONS, index: true },
    /** De 0 à 100. Ne vaut que pour le relief : il règle le froid et la barrière. */
    altitude: { type: Number, min: 0, max: 100, default: 0 },
    points: { type: [vertexSchema], required: true },
    authorId: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

// Les zones se cuisent dans l'ordre de création : la dernière dessinée l'emporte
// sur celles qu'elle recouvre, et l'écran d'administration montre cet ordre.
terrainZoneSchema.index({ createdAt: 1 });

export type TerrainZoneDocument = InferSchemaType<typeof terrainZoneSchema>;

export const TerrainZone: Model<TerrainZoneDocument> =
  (models.TerrainZone as Model<TerrainZoneDocument>) ??
  model<TerrainZoneDocument>("TerrainZone", terrainZoneSchema);
