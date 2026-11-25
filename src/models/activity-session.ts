import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** La session que l'activité Discord a ouverte pour un compte du hub. Il n'y
 *  en a qu'une par compte : un nouveau lancement révoque la précédente. Elle
 *  s'efface d'elle-même avec la session qu'elle désigne. */
const activitySessionSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    token: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

activitySessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ActivitySessionDocument = InferSchemaType<typeof activitySessionSchema>;

export const ActivitySession: Model<ActivitySessionDocument> =
  (models.ActivitySession as Model<ActivitySessionDocument>) ??
  model<ActivitySessionDocument>("ActivitySession", activitySessionSchema);
