import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/** Une instance de l'activité Discord du hub — une activité lancée dans un
 *  salon — et le panneau qu'elle montre à tous ses participants.
 *
 *  Celui qui lance l'activité le choisit, et tout participant connecté au hub
 *  peut en changer depuis le menu de l'activité. Une instance finie n'a plus
 *  rien à dire : elle s'efface d'elle-même une semaine après son dernier
 *  changement (`expiresAt`). */
const activityInstanceSchema = new Schema(
  {
    instanceId: { type: String, required: true, unique: true },
    boardId: { type: Schema.Types.ObjectId, ref: "Board", required: true },
    /** Le compte qui a posé ce panneau sur l'activité. */
    setBy: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, versionKey: false },
);

activityInstanceSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type ActivityInstanceDocument = InferSchemaType<typeof activityInstanceSchema>;

export const ActivityInstance: Model<ActivityInstanceDocument> =
  (models.ActivityInstance as Model<ActivityInstanceDocument>) ??
  model<ActivityInstanceDocument>("ActivityInstance", activityInstanceSchema);
