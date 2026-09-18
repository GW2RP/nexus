import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORT_TARGETS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportStatus,
  type ReportTarget,
} from "@/lib/domain";
import { formatAgeCompact } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import {
  countReportsByStatus,
  countStaleReports,
  listReports,
} from "@/server/queries/reports";

export const metadata: Metadata = buildMetadata({
  title: "File des signalements",
  description: "La file de modération du hub.",
  path: "/admin/signalements",
  noIndex: true,
});

export const dynamic = "force-dynamic";

const STATUS_SEGMENTS: { status: ReportStatus; label: string }[] = [
  { status: "en-attente", label: "EN ATTENTE" },
  { status: "traite", label: "TRAITÉS" },
  { status: "rejete", label: "REJETÉS" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = (
    STATUS_SEGMENTS.some((segment) => segment.status === params.etat)
      ? params.etat
      : "en-attente"
  ) as ReportStatus;
  const reason = typeof params.motif === "string" ? (params.motif as ReportReason) : undefined;
  const targetType = typeof params.type === "string" ? (params.type as ReportTarget) : undefined;

  const [reports, counts, stale] = await Promise.all([
    listReports({
      status,
      reason: REPORT_REASONS.includes(reason as ReportReason) ? reason : undefined,
      targetType: REPORT_TARGETS.includes(targetType as ReportTarget) ? targetType : undefined,
    }),
    countReportsByStatus(),
    countStaleReports(),
  ]);

  function segmentHref(next: ReportStatus) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && key !== "etat") query.set(key, value);
    }
    query.set("etat", next);
    return `/admin/signalements?${query}`;
  }

  return (
    <div className="mx-auto max-w-[1440px]">
      <PageHeader
        title="Signalements"
        subtitle={
          counts["en-attente"] > 0
            ? `${counts["en-attente"]} en attente${
                stale > 0 ? `, dont ${stale} ouvert${stale > 1 ? "s" : ""} depuis plus de 24 heures` : ""
              }.`
            : "Rien en attente."
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="État des signalements"
          segments={STATUS_SEGMENTS.map((segment) => ({
            href: segmentHref(segment.status),
            label: `${segment.label} · ${counts[segment.status]}`,
            active: status === segment.status,
          }))}
        />
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <FilterChips
          name="motif"
          legend="Filtrer par motif"
          allLabel="TOUS LES MOTIFS"
          options={REPORT_REASONS.map((value) => ({
            value,
            label: REPORT_REASON_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
        <FilterChips
          name="type"
          legend="Filtrer par type de contenu"
          allLabel="TOUS LES TYPES"
          options={REPORT_TARGETS.map((value) => ({
            value,
            label: REPORT_TARGET_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
      </div>

      {reports.length > 0 ? (
        <div className="overflow-x-auto border border-rule">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <caption className="sr-only">
              File des signalements, {STATUS_SEGMENTS.find((s) => s.status === status)?.label}
            </caption>
            <thead>
              <tr className="border-b border-rule bg-surface">
                {["Motif", "Contenu signalé", "Type", "Signalé par", "Depuis", "Actions"].map(
                  (header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-4 py-3 font-display text-[11px] font-medium uppercase tracking-[1.4px] text-ink-muted"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id} className="border-b border-hairline bg-surface last:border-b-0">
                  <td className="px-4 py-4 align-top">
                    <span className="font-display text-[11px] font-medium uppercase tracking-[1.4px] text-crimson-ink">
                      {REPORT_REASON_LABELS[report.reason]}
                    </span>
                  </td>
                  <td className="max-w-[420px] px-4 py-4 align-top">
                    <p className="text-[17px] leading-[1.5] text-ink">
                      {report.targetExcerpt ?? "Contenu supprimé depuis le signalement."}
                    </p>
                    {report.siblingCount > 1 ? (
                      <p className="mt-1 text-[15px] text-ink-muted">
                        {report.siblingCount} signalements distincts
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top text-[17px] text-ink-body">
                    {REPORT_TARGET_LABELS[report.targetType]}
                  </td>
                  <td className="px-4 py-4 align-top text-[17px] text-ink-body">
                    {report.reporter?.name ?? "Compte supprimé"}
                  </td>
                  <td className="px-4 py-4 align-top text-[17px] text-ink-muted">
                    {formatAgeCompact(new Date(report.createdAt))}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Link
                      href={`/admin/signalements/${report.id}`}
                      className="inline-flex min-h-tap items-center border border-gold px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-[1.5px] text-gold-ink hover:bg-surface-selected"
                    >
                      EXAMINER
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Aucun signalement dans cette file"
          description="Rien à examiner avec ces filtres."
        />
      )}
    </div>
  );
}
