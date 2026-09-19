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
    /**
     * Le rang d'application. Les zones se cuisent par rang croissant et la
     * dernière l'emporte sur celles qu'elle recouvre, donc un rang haut gagne.
     * Il se modifie depuis l'administration : l'ordre où les zones ont été
     * tracées ne dit rien de celle qu'on veut voir gagner, et redessiner une
     * côte pour la faire passer devant serait absurde.
     *
     * Facultatif, et sans valeur par défaut : une zone d'avant le rang n'en
     * porte aucun, et le tri la laisse là où elle se cuisait déjà — un champ
     * absent passe avant tout nombre. Un défaut à zéro la ferait donc **gagner**
     * sur ses voisines sans rang au premier enregistrement du formulaire, un
     * changement de simulation qu'aucun écran n'aurait demandé. Le premier
     * déplacement numérote toute la liste et la question ne se pose plus.
     */
    rang: { type: Number },
    authorId: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

// L'ordre d'application, et le seul : `rang` d'abord, la date de création pour
// trancher entre deux rangs égaux — ce qui laisse les zones d'avant le rang dans
// l'ordre où elles se cuisaient déjà.
terrainZoneSchema.index({ rang: 1, createdAt: 1 });

/** L'ordre d'application des zones, écrit une fois : toute lecture qui cuit un
 *  terrain ou montre la liste trie par là, sinon l'écran et la simulation
 *  finiraient par raconter deux ordres différents. */
export const ORDRE_DAPPLICATION = { rang: 1, createdAt: 1 } as const;

export type TerrainZoneDocument = InferSchemaType<typeof terrainZoneSchema>;

export const TerrainZone: Model<TerrainZoneDocument> =
  (models.TerrainZone as Model<TerrainZoneDocument>) ??
  model<TerrainZoneDocument>("TerrainZone", terrainZoneSchema);
