import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Un centre de pression, tel qu'il est repris au pas suivant. */
const systemSchema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    force: { type: Number, required: true },
    rayon: { type: Number, required: true },
    vx: { type: Number, required: true },
    vy: { type: Number, required: true },
    age: { type: Number, required: true },
    vie: { type: Number, required: true },
  },
  { _id: false },
);

/** Un pas de simulation : les 35 840 cellules du continent à un moment donné.
 *
 *  Dix champs voyagent empaquetés en entiers 16 bits (`src/lib/weather/pack.ts`)
 *  plutôt qu'en tableaux BSON : 701 Ko mesurés au lieu de 3,65 Mo. À cette
 *  maille, l'empaquetage n'est plus une économie mais une condition — chaque
 *  page du hub relit le pas courant en entier, et trois méga-octets et demi par
 *  rendu ne se tiennent pas. Et un document par pas plutôt qu'un par cellule,
 *  sans quoi l'historique ferait cent cinquante millions de documents par an. */
const weatherStepSchema = new Schema(
  {
    /** Le numéro de pas, absolu depuis l'époque. Son unicité fait l'idempotence
     *  de l'avancement : deux déclenchements du même pas, un seul document. */
    stepIndex: { type: Number, required: true, unique: true },
    /** La cadence sous laquelle ce pas a été écrit. Le numéro d'un pas vaut
     *  `jours × cadence + rang` : changer de cadence renumérote tout, donc un
     *  pas d'une autre cadence n'est pas seulement vieux, il est illisible. */
    stepsPerDay: { type: Number, required: true },
    /** La finesse de maille qui l'a produit. Les champs sont empaquetés pour un
     *  nombre de cellules donné : relus sur une autre grille, ils ne veulent
     *  rien dire. `unpackInt16` lèverait — mieux vaut ne pas les relire. */
    cellSize: { type: Number, required: true },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    seed: { type: Number, required: true },
    systems: { type: [systemSchema], default: [] },
    temperature: { type: Buffer, required: true },
    humidite: { type: Buffer, required: true },
    pression: { type: Buffer, required: true },
    ventX: { type: Buffer, required: true },
    ventY: { type: Buffer, required: true },
    couverture: { type: Buffer, required: true },
    precipitation: { type: Buffer, required: true },
    /** Le terrain cuit au moment du pas : la lecture n'a pas à relire les zones. */
    terrain: { type: Buffer, required: true },
    region: { type: Buffer, required: true },
    altitude: { type: Buffer, required: true },
  },
  { timestamps: true, versionKey: false },
);

export type WeatherStepDocument = InferSchemaType<typeof weatherStepSchema>;

export const WeatherStep: Model<WeatherStepDocument> =
  (models.WeatherStep as Model<WeatherStepDocument>) ??
  model<WeatherStepDocument>("WeatherStep", weatherStepSchema);
