import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventAccessChips } from "@/components/content/event-access-chips";
import {
  ExtendSeries,
  OccurrenceAction,
  SeriesBanner,
} from "@/components/content/series-controls";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Badge } from "@/components/ui/badge";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatGameTime, formatLongDate } from "@/lib/dates";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { formatTyrianDate, toTyrianDate } from "@/lib/tyrian-calendar";
import { getEventBySlug, listOccurrences } from "@/server/queries/events";
import type { EventSummary } from "@/server/types";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata({
    title: "Les séances de la série",
    description: "Les séances d'un évènement qui se répète.",
    path: `/evenements/${slug}/seances`,
    noIndex: true,
  });
}

/** La page d'une série : sa règle, sa pause, et ses séances une à une.
 *
 *  C'est le seul endroit où l'on retire une séance ou l'on arrête la série.
 *  L'annonce, elle, ne modifie que la séance qu'on regarde : une série se
 *  règle d'un seul endroit, sinon deux écrans se contrediraient. */
export default async function SeriesPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const event = await getEventBySlug(slug, user);
  if (!event?.seriesDetail) notFound();

  const series = event.seriesDetail;
  const occurrences = await listOccurrences(series.id, user);
  const manages = canEditContent(user, event.authorId);

  const maintenant = new Date().getTime();
  const aVenir = occurrences.filter((one) => new Date(one.startsAt).getTime() >= maintenant);
  const passees = occurrences
    .filter((one) => new Date(one.startsAt).getTime() < maintenant)
    .reverse();

  const prochaine = aVenir.find((one) => !one.cancelled);
  const tenues = aVenir.filter((one) => !one.cancelled).length;
  const retirees = aVenir.length - tenues;

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <Breadcrumb
        items={[
          { label: "Évènements", href: "/evenements" },
          { label: event.title, href: `/evenements/${event.slug}` },
          { label: "Séances" },
        ]}
      />

      <div className="mb-6 mt-4">
        <p className="mb-3 font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
          SÉRIE
        </p>
        <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
          {event.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <EventAccessChips event={event} />
        </div>
      </div>

      {manages ? (
        <SeriesBanner
          series={series}
          nextLabel={
            prochaine
              ? `Prochaine séance : ${formatLongDate(new Date(prochaine.startsAt))}.`
              : null
          }
        />
      ) : (
        <div className="border-2 border-gold bg-surface p-6">
          <p className="panel-title">{series.paused ? "Série en pause" : series.rule}</p>
          <p className="mt-1 body-compact text-ink-body">
            {series.paused
              ? "Les séances à venir ont quitté l'agenda jusqu'à la reprise."
              : (prochaine
                  ? `Prochaine séance : ${formatLongDate(new Date(prochaine.startsAt))}.`
                  : "Plus aucune séance à venir.")}
          </p>
        </div>
      )}

      <section className="mt-10" aria-labelledby="a-venir">
        <SectionHeading id="a-venir" title="Séances à venir" />
        {aVenir.length > 0 ? (
          <>
            <p className="mb-2 meta text-ink-muted">
              {tenues} tenue{tenues > 1 ? "s" : ""}
              {retirees > 0 ? ` · ${retirees} retirée${retirees > 1 ? "s" : ""}` : ""}
            </p>
            <ul>
              {aVenir.map((occurrence, rang) => (
                <OccurrenceRow
                  key={occurrence.id}
                  occurrence={occurrence}
                  manages={manages}
                  hasFollowing={rang < aVenir.length - 1}
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="body-compact text-ink-body">Plus aucune séance à venir.</p>
        )}

        {manages && series.canExtend ? (
          <div className="mt-6">
            <ExtendSeries seriesId={series.id} />
          </div>
        ) : null}
      </section>

      {passees.length > 0 ? (
        <section className="mt-10" aria-labelledby="passees">
          <SectionHeading id="passees" title="Séances passées" compact />
          <ul>
            {passees.slice(0, 8).map((occurrence) => (
              <li
                key={occurrence.id}
                className="flex items-center gap-4 border-b border-hairline py-3 last:border-b-0 sm:gap-6"
              >
                <span className="w-[78px] shrink-0 text-[16px] text-ink-muted">
                  {formatTyrianDate(new Date(occurrence.startsAt), { year: false })}
                </span>
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/evenements/${occurrence.slug}`}
                    className="text-[18px] text-ink-muted hover:underline"
                  >
                    {formatLongDate(new Date(occurrence.startsAt))}
                  </Link>
                  <span className="ml-3 meta text-ink-muted">
                    {occurrence.cancelled
                      ? "retirée"
                      : `${occurrence.registeredCount} participant${occurrence.registeredCount > 1 ? "s" : ""}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function OccurrenceRow({
  occurrence,
  manages,
  hasFollowing,
}: {
  occurrence: EventSummary;
  manages: boolean;
  hasFollowing: boolean;
}) {
  const startsAt = new Date(occurrence.startsAt);
  const tyrian = toTyrianDate(startsAt);
  const inscrits = occurrence.registeredCount;

  return (
    <li className="flex items-start gap-4 border-b border-hairline py-4 last:border-b-0 sm:gap-6 sm:py-5">
      <div className="flex w-[70px] shrink-0 flex-col items-start sm:w-[78px] sm:border-r sm:border-hairline sm:pr-4">
        <span
          className={`font-display text-[26px] font-bold leading-none ${
            occurrence.cancelled ? "text-ink-muted" : ""
          }`}
        >
          {tyrian.day}
        </span>
        <span className="mt-1 caption text-ink-muted">{tyrian.season}</span>
      </div>

      <div className="min-w-0 flex-1">
        <h3
          className={`font-display text-[19px] font-semibold leading-[1.25] sm:text-[21px] ${
            occurrence.cancelled ? "text-ink-muted" : ""
          }`}
        >
          <Link href={`/evenements/${occurrence.slug}`} className="hover:underline">
            {formatLongDate(startsAt)}
          </Link>
        </h3>
        <p className="mt-1 meta text-ink-muted">
          {occurrence.locationLabel} · {formatGameTime(startsAt)} ·{" "}
          {inscrits === 0 ? "personne d'inscrit" : `${inscrits} inscrit${inscrits > 1 ? "s" : ""}`}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {occurrence.cancelled ? (
          <Badge variant="neutral">RETIRÉE</Badge>
        ) : occurrence.series?.paused ? (
          <Badge variant="neutral">EN PAUSE</Badge>
        ) : (
          <Badge>À VENIR</Badge>
        )}
        {manages ? (
          <OccurrenceAction
            eventId={occurrence.id}
            cancelled={occurrence.cancelled}
            title={occurrence.title}
            whenLabel={formatLongDate(startsAt)}
            registeredCount={inscrits}
            hasFollowing={hasFollowing}
          />
        ) : null}
      </div>
    </li>
  );
}
