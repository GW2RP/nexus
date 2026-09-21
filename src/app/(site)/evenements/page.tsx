import type { Metadata } from "next";
import Link from "next/link";

import { EventCalendar } from "@/components/content/event-calendar";
import { EventRow } from "@/components/content/event-row";
import { InvitationCodeForm } from "@/components/content/invitation-code-form";
import { CheckIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
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
  // « Publiques », « sur invitation », « mes groupes » : la même liste, vue par
  // le bout qu'on choisit. Sans valeur, tout ce que le compte a le droit de voir.
  const acces =
    params.acces === "publiques" || params.acces === "invitation" || params.acces === "groupes"
      ? params.acces
      : undefined;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  const events = await listEvents({
    type: EVENT_TYPES.includes(type as EventType) ? type : undefined,
    region: REGIONS.includes(region as Region) ? region : undefined,
    registeredFor: onlyMine ? user!.id : undefined,
    access: acces,
    viewer: user,
    from: view === "calendrier" ? monthStart : undefined,
    to: view === "calendrier" ? monthEnd : undefined,
    includePast: view === "calendrier",
    limit: 120,
  });

  // Tous les liens de l'agenda se dérivent des paramètres courants : chacun
  // change ce qu'il change, et laisse le reste. Sans cette base commune, le lien
  // qui décoche « mes inscriptions » repartait du `mes=1` qu'il devait retirer,
  // et la case ne se décochait pas.
  const courant = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value) courant.set(key, value);
  }

  function lien(changes: Record<string, string | null>): string {
    const suivant = new URLSearchParams(courant);
    for (const [key, value] of Object.entries(changes)) {
      if (value) suivant.set(key, value);
      else suivant.delete(key);
    }
    const query = suivant.toString();
    return query ? `/evenements?${query}` : "/evenements";
  }

  // La bascule de vue conserve les filtres : ils vivent dans l'URL.
  const agendaHref = lien({ vue: null });
  const calendrierHref = lien({ vue: "calendrier" });
  const mesInscriptionsHref = lien({ mes: onlyMine ? null : "1" });

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
            { href: calendrierHref, label: "CALENDRIER", active: view === "calendrier" },
          ]}
        />
        {user ? (
          // Une case à cocher qui se décoche : le lien porte l'état inverse de
          // celui affiché, et l'annonce plutôt que de le laisser à la couleur.
          <Link
            href={mesInscriptionsHref}
            aria-label={
              onlyMine
                ? "Uniquement mes inscriptions : activé. Afficher toutes les scènes."
                : "N'afficher que mes inscriptions."
            }
            className="flex min-h-tap items-center gap-3 text-[17px] text-ink-body"
          >
            <span
              aria-hidden="true"
              className={`inline-flex size-[18px] shrink-0 items-center justify-center border ${
                onlyMine
                  ? "border-crimson bg-crimson text-on-crimson"
                  : "border-rule bg-surface-inset"
              }`}
            >
              {onlyMine ? <CheckIcon size={12} /> : null}
            </span>
            Uniquement mes inscriptions
          </Link>
        ) : null}

        <InvitationCodeForm labelHidden className="sm:ml-auto" />
      </div>

      {/* Trois listes déroulantes sur une ligne : alignés en boutons, les mêmes
          filtres poussaient la première semaine hors de l'écran. */}
      <div className="mb-8 flex flex-wrap items-end gap-4">
        <FilterSelect
          name="type"
          label="Type de scène"
          allLabel="Tous les types"
          options={EVENT_TYPES.map((value) => ({ value, label: EVENT_TYPE_LABELS[value] }))}
        />
        <FilterSelect
          name="region"
          label="Région"
          allLabel="Toute la Tyrie"
          options={REGIONS.map((value) => ({ value, label: REGION_LABELS[value] }))}
        />
        {user ? (
          <FilterSelect
            name="acces"
            label="Accès"
            allLabel="Toutes les scènes"
            options={[
              { value: "publiques", label: "Publiques" },
              { value: "invitation", label: "Sur invitation" },
              { value: "groupes", label: "Mes groupes" },
            ]}
          />
        ) : null}
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
