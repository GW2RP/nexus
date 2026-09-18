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

/** Un pas de simulation : les 560 cellules du continent à un moment donné.
 *
 *  Les champs voyagent empaquetés en entiers 16 bits (`src/lib/weather/pack.ts`)
 *  plutôt qu'en tableaux BSON : 8 Ko au lieu de 50, et un document par pas au
 *  lieu d'un par cellule — sans quoi l'historique ferait 800 000 documents par an. */
const weatherStepSchema = new Schema(
  {
    /** Le numéro de pas, absolu depuis l'époque. Son unicité fait l'idempotence
     *  de l'avancement : deux déclenchements du même pas, un seul document. */
    stepIndex: { type: Number, required: true, unique: true },
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
