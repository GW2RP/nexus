import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ModerationDecision } from "@/components/forms/moderation-decision";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  REPORT_TARGET_PATHS,
} from "@/lib/domain";
import { formatAgeCompact, formatLongDate } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import { getReport, getSiblingReports } from "@/server/queries/reports";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = buildMetadata({
  title: "Examen d'un signalement",
  description: "Examiner un signalement du hub.",
  path: "/admin/signalements",
  noIndex: true,
});

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const siblings = await getSiblingReports(report);
  const targetHref = report.targetSlug
    ? REPORT_TARGET_PATHS[report.targetType](report.targetSlug)
    : null;

  return (
    <div className="mx-auto max-w-[1100px]">
      <Breadcrumb
        items={[
          { label: "Signalements", href: "/admin/signalements" },
          { label: REPORT_REASON_LABELS[report.reason] },
        ]}
      />

      <PageHeader
        eyebrow={REPORT_TARGET_LABELS[report.targetType].toLocaleUpperCase("fr-FR")}
        title={REPORT_REASON_LABELS[report.reason]}
        subtitle={`Signalé il y a ${formatAgeCompact(new Date(report.createdAt))} · ${
          REPORT_STATUS_LABELS[report.status]
        }`}
      />

      <div className="flex flex-col gap-10 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          <section className="mb-10" aria-labelledby="contenu-signale">
            <SectionHeading id="contenu-signale" title="Le contenu signalé" />
            <Card inset className="gap-3 p-6">
              <p className="text-[19px] italic leading-[1.55] text-ink">
                {report.targetExcerpt ?? "Le contenu a été supprimé depuis le signalement."}
              </p>
              {targetHref ? (
                <Link
                  href={targetHref}
                  className="text-[17px] text-crimson-ink underline-offset-4 hover:underline"
                >
                  Ouvrir la fiche →
                </Link>
              ) : null}
            </Card>
          </section>

          <section className="mb-10" aria-labelledby="ce-quon-reproche">
            <SectionHeading id="ce-quon-reproche" title="Ce qu'on reproche" />
            <ul className="flex flex-col">
              {[report, ...siblings].map((entry) => (
                <li key={entry.id} className="border-b border-hairline py-4 last:border-b-0">
                  <p className="font-display text-[11px] font-medium tracking-[1.4px] text-crimson-ink">
                    {REPORT_REASON_LABELS[entry.reason]}
                  </p>
                  {entry.comment ? (
                    <p className="mt-2 text-[18px] leading-[1.55] text-ink-body">
                      {entry.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-[17px] text-ink-muted">Sans commentaire.</p>
                  )}
                  <p className="mt-2 text-[15px] text-ink-muted">
                    {entry.reporter?.name ?? "Compte supprimé"} ·{" "}
                    {formatLongDate(new Date(entry.createdAt))}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {report.status !== "en-attente" ? (
            <section aria-labelledby="decision-prise">
              <SectionHeading id="decision-prise" title="Décision prise" />
              <Card inset className="gap-2 p-6">
                <p className="text-[18px] text-ink">{REPORT_STATUS_LABELS[report.status]}</p>
                {report.resolutionNote ? (
                  <p className="text-[18px] leading-[1.55] text-ink-body">
                    {report.resolutionNote}
                  </p>
                ) : null}
                <p className="text-[15px] text-ink-muted">
                  {report.resolvedBy?.name ?? "L'équipe"} ·{" "}
                  {report.resolvedAt ? formatLongDate(new Date(report.resolvedAt)) : ""}
                </p>
              </Card>
            </section>
          ) : null}
        </div>

        <aside className="lg:w-[380px] lg:shrink-0">
          {report.status === "en-attente" ? (
            <Card accent className="p-6">
              <h2 className="mb-4 font-display text-[18px] font-semibold tracking-[1px]">
                TRANCHER
              </h2>
              <ModerationDecision report={report} />
            </Card>
          ) : (
            <Card inset className="p-6">
              <p className="body-compact text-ink-body">
                Ce signalement est déjà tranché. Le journal en garde la trace.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
