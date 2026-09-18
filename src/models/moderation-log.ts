import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { MODERATION_ACTIONS, REPORT_TARGETS } from "@/lib/domain";

/** Le journal : toute action de modération y est inscrite avec son auteur,
 *  sa date et son motif. Rien ne s'y efface. */
const moderationLogSchema = new Schema(
  {
    action: { type: String, enum: MODERATION_ACTIONS, required: true, index: true },
    targetType: { type: String, enum: REPORT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetExcerpt: { type: String, maxlength: 400 },
    reportId: { type: Schema.Types.ObjectId, ref: "Report" },
    reason: { type: String, required: true, maxlength: 2000 },
    notifyAuthor: { type: Boolean, default: false },
    moderatorId: { type: String, required: true, index: true },
  },
  { timestamps: true, versionKey: false },
);

export type ModerationLogDocument = InferSchemaType<typeof moderationLogSchema>;

export const ModerationLog: Model<ModerationLogDocument> =
  (models.ModerationLog as Model<ModerationLogDocument>) ??
  model<ModerationLogDocument>("ModerationLog", moderationLogSchema);
