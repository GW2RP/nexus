import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { REGIONS, WEATHER_CONDITIONS } from "@/lib/domain";

/** Une entrée de météo : une région, une condition, une période.
 *  L'écriture est réservée aux conteurs et à l'administration. */
const weatherSchema = new Schema(
  {
    region: { type: String, enum: REGIONS, required: true, index: true },
    condition: { type: String, enum: WEATHER_CONDITIONS, required: true },
    intensity: { type: Number, min: 0, max: 100, default: 50 },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    note: { type: String, maxlength: 240 },
    authorId: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

weatherSchema.index({ region: 1, startsAt: 1 });

export type WeatherDocument = InferSchemaType<typeof weatherSchema>;

export const Weather: Model<WeatherDocument> =
  (models.Weather as Model<WeatherDocument>) ?? model<WeatherDocument>("Weather", weatherSchema);
