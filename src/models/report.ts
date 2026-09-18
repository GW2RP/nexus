import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { REPORT_REASONS, REPORT_STATUSES, REPORT_TARGETS } from "@/lib/domain";

/** Un signalement. Plusieurs signalements peuvent viser le même contenu :
 *  la file les regroupe par cible pour que l'équipe ne tranche qu'une fois. */
const reportSchema = new Schema(
  {
    targetType: { type: String, enum: REPORT_TARGETS, required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    /** Extrait figé au moment du signalement : le contenu peut être modifié ensuite. */
    targetExcerpt: { type: String, maxlength: 400 },
    targetSlug: { type: String },
    reason: { type: String, enum: REPORT_REASONS, required: true, index: true },
    comment: { type: String, maxlength: 2000 },
    reporterId: { type: String, required: true, index: true },
    status: { type: String, enum: REPORT_STATUSES, default: "en-attente", index: true },
    resolvedBy: { type: String },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, maxlength: 2000 },
  },
  { timestamps: true, versionKey: false },
);

// Un compte ne signale qu'une fois le même contenu.
reportSchema.index({ targetType: 1, targetId: 1, reporterId: 1 }, { unique: true });

export type ReportDocument = InferSchemaType<typeof reportSchema>;

export const Report: Model<ReportDocument> =
  (models.Report as Model<ReportDocument>) ?? model<ReportDocument>("Report", reportSchema);
