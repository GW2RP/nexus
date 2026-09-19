import type { Metadata } from "next";
import Link from "next/link";

import { EventCalendar } from "@/components/content/event-calendar";
import { EventRow } from "@/components/content/event-row";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  REGIONS,
  REGION_LABELS,
  type EventType,
  type Region,
} from "@/lib/domain";
import { formatShortDate, startOfGameWeek } from "@/lib/dates";
import { canContribute } from "@/lib/permissions";
import { SITE_URL, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { formatTyrianDate, formatTyrianSeason } from "@/lib/tyrian-calendar";
import { listEvents } from "@/server/queries/events";
import type { EventSummary } from "@/server/types";

export const metadata: Metadata = buildMetadata({
  title: "Agenda des évènements",
  description:
    "Toutes les scènes annoncées par la communauté : veillées de taverne, expéditions, cérémonies et intrigues, avec leur lieu, leur heure et leurs inscriptions.",
  path: "/evenements",
  keywords: ["agenda RP Guild Wars 2", "évènements roleplay GW2", "soirée RP Tyrie"],
});

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const view = params.vue === "calendrier" ? "calendrier" : "agenda";
  const type = typeof params.type === "string" ? (params.type as EventType) : undefined;
  const region = typeof params.region === "string" ? (params.region as Region) : undefined;
  const onlyMine = params.mes === "1" && Boolean(user);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  const events = await listEvents({
    type: EVENT_TYPES.includes(type as EventType) ? type : undefined,
    region: REGIONS.includes(region as Region) ? region : undefined,
    registeredFor: onlyMine ? user!.id : undefined,
    viewerId: user?.id ?? null,
    from: view === "calendrier" ? monthStart : undefined,
    to: view === "calendrier" ? monthEnd : undefined,
    includePast: view === "calendrier",
    limit: 120,
  });

  // La bascule de vue conserve les filtres : ils vivent dans l'URL.
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && key !== "vue") query.set(key, value);
  }
  const agendaHref = query.toString() ? `/evenements?${query}` : "/evenements";
  const calendarQuery = new URLSearchParams(query);
  calendarQuery.set("vue", "calendrier");

  const weeks = groupByWeek(events);

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Agenda des évènements",
    url: `${SITE_URL}/evenements`,
    numberOfItems: events.length,
    itemListElement: events.slice(0, 20).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Event",
        name: event.title,
        url: `${SITE_URL}/evenements/${event.slug}`,
        startDate: event.startsAt,
        endDate: event.endsAt ?? undefined,
        eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
        location: { "@type": "VirtualLocation", name: event.locationLabel },
      },
    })),
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listJsonLd)} />

      <PageHeader
        title="Évènements"
        subtitle={`${formatTyrianSeason(now)} · ${events.length} scène${
          events.length > 1 ? "s" : ""
        } annoncée${events.length > 1 ? "s" : ""}`}
        action={
          <Button asChild size="lead">
            <Link href={canContribute(user) ? "/evenements/nouveau" : "/connexion"}>
              PROPOSER UN ÉVÈNEMENT
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-4">
        <SegmentedControl
          label="Vue de l'agenda"
          segments={[
            { href: agendaHref, label: "AGENDA", active: view === "agenda" },
            {
              href: `/evenements?${calendarQuery}`,
              label: "CALENDRIER",
              active: view === "calendrier",
            },
          ]}
        />
        {user ? (
          <Link
            href={
              onlyMine
                ? agendaHref
                : `/evenements?${new URLSearchParams({ ...Object.fromEntries(query), mes: "1" })}`
            }
            className="flex min-h-tap items-center gap-3 text-[17px] text-ink-body"
          >
            <span
              aria-hidden="true"
              className={`inline-block size-[18px] border ${
                onlyMine ? "border-crimson bg-crimson" : "border-rule bg-surface-inset"
              }`}
            />
            Uniquement mes inscriptions
          </Link>
        ) : null}
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <FilterChips
          name="type"
          legend="Filtrer par type d'évènement"
          allLabel="TOUS LES TYPES"
          options={EVENT_TYPES.map((value) => ({
            value,
            label: EVENT_TYPE_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
        <FilterChips
          name="region"
          legend="Filtrer par région"
          allLabel="TOUTE LA TYRIE"
          options={REGIONS.map((value) => ({
            value,
            label: REGION_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="Aucun évènement annoncé"
          action={
            <Button asChild variant="outline">
              <Link href={canContribute(user) ? "/evenements/nouveau" : "/connexion"}>
                PROPOSER UN ÉVÈNEMENT
              </Link>
            </Button>
          }
        />
      ) : view === "calendrier" ? (
        <>
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="font-display text-[22px] font-semibold capitalize sm:text-[27px]">
              {new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(now)}
            </h2>
            <p className="text-[16px] text-ink-muted">{formatTyrianSeason(now)}</p>
          </div>
          <EventCalendar month={monthStart} events={events} />
        </>
      ) : (
        <div className="flex flex-col gap-10">
          {weeks.map((week) => (
            <section key={week.key} aria-labelledby={`semaine-${week.key}`}>
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2
                  id={`semaine-${week.key}`}
                  className="panel-title"
                >
                  Semaine du {formatTyrianDate(week.start, { year: false })}
                </h2>
                <p className="text-[16px] text-ink-muted">
                  {formatShortDate(week.start)} – {formatShortDate(week.end)}
                </p>
              </div>
              <div className="mb-5 h-px bg-rule" />
              <ul>
                {week.events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

/** Les lignes se regroupent sous un intertitre : « Semaine du 21 Zéphyr ». */
function groupByWeek(events: EventSummary[]) {
  const weeks = new Map<string, { key: string; start: Date; end: Date; events: EventSummary[] }>();

  for (const event of events) {
    const start = startOfGameWeek(new Date(event.startsAt));
    const key = start.toISOString().slice(0, 10);
    const existing = weeks.get(key);
    if (existing) {
      existing.events.push(event);
    } else {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      weeks.set(key, { key, start, end, events: [event] });
    }
  }

  return [...weeks.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
