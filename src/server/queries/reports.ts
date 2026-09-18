import "server-only";


import type { ReportReason, ReportStatus, ReportTarget } from "@/lib/domain";
import { ModerationLog } from "@/models/moderation-log";
import { Report, type ReportDocument } from "@/models/report";
import {
  type QueryFilter,
  connectToDatabase,
  loadAuthors,
  toIso,
  toIsoOrNull,
  toObjectId,
} from "@/server/queries/shared";
import type { ReportRow } from "@/server/types";

type ListOptions = {
  status?: ReportStatus;
  reason?: ReportReason;
  targetType?: ReportTarget;
};

async function hydrate(docs: (ReportDocument & { _id: unknown })[]): Promise<ReportRow[]> {
  if (docs.length === 0) return [];

  const authors = await loadAuthors([
    ...docs.map((doc) => doc.reporterId),
    ...docs.map((doc) => doc.resolvedBy),
  ]);

  // Combien de signalements distincts visent chacun de ces contenus.
  const siblings = await Report.aggregate<{ _id: { t: string; id: unknown }; count: number }>([
    {
      $match: {
        targetId: { $in: docs.map((doc) => doc.targetId) },
        status: "en-attente",
      },
    },
    { $group: { _id: { t: "$targetType", id: "$targetId" }, count: { $sum: 1 } } },
  ]);
  const siblingCount = new Map(
    siblings.map((row) => [`${row._id.t}:${String(row._id.id)}`, row.count]),
  );

  return docs.map((doc) => ({
    id: String(doc._id),
    targetType: doc.targetType as ReportTarget,
    targetId: String(doc.targetId),
    targetSlug: doc.targetSlug ?? null,
    targetExcerpt: doc.targetExcerpt ?? null,
    reason: doc.reason as ReportReason,
    comment: doc.comment ?? null,
    status: doc.status as ReportStatus,
    reporter: authors.get(doc.reporterId) ?? null,
    siblingCount: siblingCount.get(`${doc.targetType}:${String(doc.targetId)}`) ?? 1,
    createdAt: toIso(doc.createdAt),
    resolvedAt: toIsoOrNull(doc.resolvedAt),
    resolutionNote: doc.resolutionNote ?? null,
    resolvedBy: doc.resolvedBy ? (authors.get(doc.resolvedBy) ?? null) : null,
  }));
}

export async function listReports(options: ListOptions = {}) {
  await connectToDatabase();

  const filter: QueryFilter = {};
  if (options.status) filter.status = options.status;
  if (options.reason) filter.reason = options.reason;
  if (options.targetType) filter.targetType = options.targetType;

  const docs = await Report.find(filter as never).sort({ createdAt: 1 }).lean();
  return hydrate(docs as (ReportDocument & { _id: unknown })[]);
}

export async function countReportsByStatus() {
  await connectToDatabase();
  const rows = await Report.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const counts: Record<ReportStatus, number> = { "en-attente": 0, traite: 0, rejete: 0 };
  for (const row of rows) {
    if (row._id in counts) counts[row._id as ReportStatus] = row.count;
  }
  return counts;
}

/** Les signalements ouverts depuis plus de 24 heures — la file les met en avant. */
export async function countStaleReports() {
  await connectToDatabase();
  const yesterday = new Date(Date.now() - 24 * 3_600_000);
  return Report.countDocuments({ status: "en-attente", createdAt: { $lte: yesterday } });
}

export async function getReport(id: string): Promise<ReportRow | null> {
  await connectToDatabase();
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const doc = await Report.findById(objectId).lean();
  if (!doc) return null;
  const [row] = await hydrate([doc as ReportDocument & { _id: unknown }]);
  return row;
}

/** Les autres signalements qui visent le même contenu : l'équipe ne tranche qu'une fois. */
export async function getSiblingReports(report: ReportRow): Promise<ReportRow[]> {
  await connectToDatabase();
  const objectId = toObjectId(report.targetId);
  if (!objectId) return [];
  const docs = await Report.find({
    targetId: objectId,
    targetType: report.targetType,
    _id: { $ne: toObjectId(report.id) },
  })
    .sort({ createdAt: 1 })
    .lean();
  return hydrate(docs as (ReportDocument & { _id: unknown })[]);
}

export async function listModerationLog(limit = 40) {
  await connectToDatabase();
  const docs = await ModerationLog.find().sort({ createdAt: -1 }).limit(limit).lean();
  const authors = await loadAuthors(docs.map((doc) => doc.moderatorId));
  return docs.map((doc) => ({
    id: String(doc._id),
    action: doc.action,
    targetType: doc.targetType as ReportTarget,
    targetExcerpt: doc.targetExcerpt ?? null,
    reason: doc.reason,
    moderator: authors.get(doc.moderatorId) ?? null,
    createdAt: toIso(doc.createdAt),
  }));
}
