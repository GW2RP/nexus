import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Une inscription à un évènement. Au-delà de la capacité, la place part en liste d'attente. */
const registrationSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true, index: true },
    userId: { type: String, required: true, index: true },
    characterId: { type: Schema.Types.ObjectId, ref: "Character" },
    status: {
      type: String,
      enum: ["inscrit", "liste-attente"],
      default: "inscrit",
      index: true,
    },
  },
  { timestamps: true, versionKey: false },
);

// Un compte ne s'inscrit qu'une fois par évènement.
registrationSchema.index({ eventId: 1, userId: 1 }, { unique: true });

export type RegistrationDocument = InferSchemaType<typeof registrationSchema>;

export const Registration: Model<RegistrationDocument> =
  (models.Registration as Model<RegistrationDocument>) ??
  model<RegistrationDocument>("Registration", registrationSchema);
