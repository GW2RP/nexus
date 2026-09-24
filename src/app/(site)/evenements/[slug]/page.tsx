import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventAccessChips } from "@/components/content/event-access-chips";
import { EventSharePanel } from "@/components/content/event-share-panel";
import { RegistrationPanel } from "@/components/content/registration-panel";
import { WeatherBadge } from "@/components/content/weather-badge";
import { ReportDialog } from "@/components/report-dialog";
import { RoundPortrait } from "@/components/ui/framed-media";
import { DeleteContent } from "@/components/content/delete-content";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EventTypeChip } from "@/components/ui/chip";
import { FramedMedia } from "@/components/ui/framed-media";
import { RichText } from "@/components/ui/rich-text";
import { SectionHeading } from "@/components/ui/section-heading";
import { EVENT_TYPE_LABELS, REGION_LABELS, raceLabel } from "@/lib/domain";
import { GAME_TIME_ZONE, formatGameTime, formatLongDate } from "@/lib/dates";
import { GroupIcon, LockIcon, RepeatIcon } from "@/components/icons";
import { canContribute, canEditContent, canReportContent } from "@/lib/permissions";
import { SITE_URL, breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deleteEventAction } from "@/server/actions/events";
import { formatTyrianDate, formatTyrianSeason } from "@/lib/tyrian-calendar";
import { listCharactersOf } from "@/server/queries/characters";
import { getEventBySlug } from "@/server/queries/events";
import { getWeatherAt, getWeatherForRegion } from "@/server/queries/weather";

type Props = { params: Promise<{ slug: string }> };

/** Ces fiches se lisent différemment selon la personne connectée — bouton de
 *  modification, drapeau de signalement, état d'inscription. Elles sont donc
 *  rendues à chaque requête. Déclarer en plus `generateStaticParams` mettait la
 *  route en contradiction avec elle-même : Next tentait de générer une page
 *  statique pour un slug inconnu, et la lecture de la session y échouait avec
 *  `DYNAMIC_SERVER_USAGE`. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  // La session se lit ici aussi : sans elle, l'onglet d'une scène privée
  // annoncerait « introuvable » à qui vient pourtant d'y être invité.
  const user = await getCurrentUser();
  const event = await getEventBySlug(slug, user);
  if (!event) {
    return buildMetadata({
      title: "Évènement introuvable",
      description: "Cette annonce n'est plus à l'agenda.",
      path: `/evenements/${slug}`,
      noIndex: true,
    });
  }

  const startsAt = new Date(event.startsAt);
  return buildMetadata({
    title: event.title,
    description:
      event.summary ??
      `${EVENT_TYPE_LABELS[event.type]} le ${formatLongDate(startsAt)} à ${formatGameTime(startsAt)} — ${event.locationLabel}.`,
    path: `/evenements/${event.slug}`,
    image: event.bannerUrl,
    imageAlt: event.bannerAlt ?? `Bannière de ${event.title}`,
    type: "article",
    publishedTime: event.createdAt,
    modifiedTime: event.updatedAt,
    authors: event.author ? [event.author.name] : undefined,
    keywords: [event.title, EVENT_TYPE_LABELS[event.type], "évènement RP Guild Wars 2"],
    // Une scène privée n'a rien à faire dans un index : son adresse est tout
    // ce qui la protège, et `generateMetadata` la lit sans session.
    noIndex: event.visibility === "privee",
  });
}

export default async function EventPage({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const event = await getEventBySlug(slug, user);
  if (!event) notFound();

  const [characters, weather] = await Promise.all([
    user ? listCharactersOf(user.id) : Promise.resolve([]),
    event.coordinates && event.region
      ? getWeatherAt(event.coordinates, event.region)
      : event.region
        ? getWeatherForRegion(event.region)
        : Promise.resolve(null),
  ]);

  const startsAt = new Date(event.startsAt);
  const endsAt = event.endsAt ? new Date(event.endsAt) : null;
  const isOwner = canEditContent(user, event.authorId);

  const eventJsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    url: `${SITE_URL}/evenements/${event.slug}`,
    description: event.summary ?? event.description ?? undefined,
    image: event.bannerUrl ?? undefined,
    startDate: event.startsAt,
    endDate: event.endsAt ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", name: event.locationLabel },
    organizer: event.organiser
      ? { "@type": "Person", name: event.organiser.name }
      : event.author
        ? { "@type": "Person", name: event.author.name }
        : undefined,
    maximumAttendeeCapacity: event.capacity ?? undefined,
    isAccessibleForFree: true,
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(eventJsonLd)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Évènements", path: "/evenements" },
            { name: event.title, path: `/evenements/${event.slug}` },
          ]),
        )}
      />

      <Breadcrumb
        items={[
          { label: "Évènements", href: "/evenements" },
          { label: formatTyrianSeason(startsAt), href: "/evenements" },
          { label: event.title },
        ]}
      />

      <FramedMedia
        src={event.bannerUrl}
        alt={event.bannerAlt ?? `Bannière de ${event.title}`}
        placeholder="BANNIÈRE DE L'ÉVÈNEMENT"
        dimensions={event.bannerUrl ? undefined : "1600 × 500"}
        aspect="16 / 5"
      >
        <span className="absolute left-4 top-4 flex flex-wrap items-center gap-2">
          <EventTypeChip type={event.type} onImage />
          <EventAccessChips event={event} onImage />
        </span>
      </FramedMedia>

      <div className="mt-10 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
            {event.title}
          </h1>
          <p className="mt-3 text-[18px] leading-[1.55] text-ink-muted">
            <time dateTime={event.startsAt}>{formatLongDate(startsAt)}</time> ·{" "}
            {formatTyrianDate(startsAt)} · {formatGameTime(startsAt)}
            {endsAt ? ` → ${formatGameTime(endsAt)}` : ""}
            {event.organiser ? (
              <>
                {" · organisé par "}
                <Link
                  href={`/personnages/${event.organiser.slug}`}
                  className="text-crimson-ink underline-offset-4 hover:underline"
                >
                  {event.organiser.name}
                </Link>
              </>
            ) : null}
          </p>

          {event.cancelled ? (
            <p className="mt-6 flex items-start gap-3 border-2 border-rule bg-chip px-4 py-[14px] body-compact text-ink-body">
              <RepeatIcon size={17} className="mt-1 text-ink-subtle" />
              <span>
                Cette séance a été retirée de sa série : elle ne se tient pas, et elle a quitté
                l&apos;agenda. Les autres séances ne changent pas.
              </span>
            </p>
          ) : null}

          {event.visibility === "privee" ? (
            <p className="mt-6 flex items-start gap-3 border border-rule bg-surface-inset px-4 py-[14px] body-compact text-ink-body">
              <LockIcon size={17} className="mt-1 text-ink-subtle" />
              <span>
                Hors de l&apos;agenda public. Seuls les comptes invités, ceux qui ont le lien
                {event.group ? `, et les membres de ${event.group.name}` : ""} voient cette
                annonce.
              </span>
            </p>
          ) : null}

          {event.description ? <RichText text={event.description} className="mt-7" /> : null}

          {event.practicalNotes.length > 0 ? (
            <section className="mt-10" aria-labelledby="a-savoir">
              <SectionHeading id="a-savoir" title="Ce qu'il faut savoir" />
              <ul className="flex flex-col gap-3">
                {event.practicalNotes.map((note, index) => (
                  <li
                    key={index}
                    className="border-l-2 border-gold pl-4 text-[18px] leading-[1.55] text-ink-body"
                  >
                    {note}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {event.placeDetail ? (
            <section className="mt-10" aria-labelledby="le-lieu">
              <SectionHeading id="le-lieu" title="Le lieu" />
              <Card inset className="gap-3 p-6">
                <h3 className="font-display text-[21px] font-semibold">
                  <Link href={`/lieux/${event.placeDetail.slug}`} className="hover:underline">
                    {event.placeDetail.name}
                  </Link>
                </h3>
                <p className="text-[16px] text-ink-muted">
                  {[event.placeDetail.district, REGION_LABELS[event.placeDetail.region]]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {event.placeDetail.summary ? (
                  <p className="body-compact text-ink-body">
                    {event.placeDetail.summary}
                  </p>
                ) : null}
                <Link
                  href={`/carte?lieu=${event.placeDetail.slug}`}
                  className="text-[17px] text-crimson-ink underline-offset-4 hover:underline"
                >
                  Voir sur la carte →
                </Link>
              </Card>
            </section>
          ) : null}

          <section className="mt-10" aria-labelledby="participants">
            <SectionHeading
              id="participants"
              title={`Participants inscrits${
                event.capacity ? ` · ${event.registeredCount} sur ${event.capacity} places` : ""
              }`}
            />
            {event.participants.length > 0 ? (
              <ul className="mb-4 flex flex-wrap gap-4">
                {event.participants.map((participant) => (
                  <li key={participant.id} className="flex items-center gap-3">
                    <RoundPortrait size={40} />
                    <span>
                      <Link
                        href={`/personnages/${participant.slug}`}
                        className="block font-display text-[17px] text-ink hover:underline"
                      >
                        {participant.name}
                      </Link>
                      <span className="block text-[15px] text-ink-muted">
                        {raceLabel(participant.race, participant.gender)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : event.unnamedParticipantCount === 0 ? (
              <p className="body-compact text-ink-muted">
                Personne n'est encore inscrit. La première place est à prendre.
              </p>
            ) : null}
            {event.unnamedParticipantCount > 0 ? (
              <p className="body-compact text-ink-muted">
                {event.unnamedParticipantCount} inscrit
                {event.unnamedParticipantCount > 1 ? "s" : ""} sans personnage
              </p>
            ) : null}
          </section>
        </div>

        <aside className="lg:w-[340px] lg:shrink-0">
          <Card accent className="mb-6 gap-4 p-6">
            <dl className="flex flex-col">
              <Fact label="Date tyrienne" value={formatTyrianDate(startsAt)} />
              <Fact label="Date réelle" value={formatLongDate(startsAt)} />
              <Fact
                label="Heure"
                value={`${formatGameTime(startsAt)}${endsAt ? ` → ${formatGameTime(endsAt)}` : ""} (${GAME_TIME_ZONE})`}
              />
              <Fact label="Lieu" value={event.locationLabel} />
              <Fact
                label="Places prises"
                value={event.capacity ? `${event.registeredCount} / ${event.capacity}` : `${event.registeredCount}`}
              />
            </dl>

            <div className="border-t border-hairline pt-4">
              <RegistrationPanel
                event={event}
                characters={characters}
                isSignedIn={Boolean(user)}
                canRegister={canContribute(user)}
              />
            </div>
          </Card>

          {isOwner && event.visibility === "privee" && event.shareCode ? (
            <Card accent className="mb-6 gap-4 p-6">
              <p className="font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
                PARTAGE
              </p>
              <EventSharePanel
                eventId={event.id}
                shareUrl={`${SITE_URL}/invitation/${event.shareCode}`}
                shareCode={event.shareCode}
                invited={event.invited}
                authorId={event.authorId}
                registeredIds={event.registeredUserIds}
              />
            </Card>
          ) : null}

          {event.group ? (
            <section className="mb-6" aria-labelledby="groupe-de-la-scene">
              <SectionHeading id="groupe-de-la-scene" title="Groupe associé" compact />
              <p className="flex items-center gap-2 font-display text-[18px]">
                <GroupIcon size={15} className="text-ink-subtle" />
                <Link href={`/groupes/${event.group.slug}`} className="hover:underline">
                  {event.group.name}
                </Link>
              </p>
              <p className="mt-1 text-[16px] text-ink-muted">
                Ses membres voient la scène et peuvent la rejoindre.
              </p>
            </section>
          ) : null}

          {event.seriesDetail ? (
            <section className="mb-6" aria-labelledby="serie-de-la-scene">
              <SectionHeading id="serie-de-la-scene" title="Répétition" compact />
              <p className="flex items-center gap-2 text-[17px]">
                <RepeatIcon size={15} className="text-ink-subtle" />
                {event.seriesDetail.paused ? "Série en pause" : event.seriesDetail.rule}
              </p>
              <p className="mt-2">
                <Link
                  href={`/evenements/${event.slug}/seances`}
                  className="text-[17px] text-crimson-ink underline-offset-4 hover:underline"
                >
                  Voir les séances →
                </Link>
              </p>
            </section>
          ) : null}

          {weather ? (
            <section className="mb-6" aria-labelledby="meteo-evenement">
              <SectionHeading id="meteo-evenement" title="Météo sur place" compact />
              <WeatherBadge weather={weather} />
            </section>
          ) : null}

          {event.organiser ? (
            <section className="mb-6" aria-labelledby="organisateur">
              <SectionHeading id="organisateur" title="Organisation" compact />
              <p className="font-display text-[18px]">
                <Link
                  href={`/personnages/${event.organiser.slug}`}
                  className="hover:underline"
                >
                  {event.organiser.name}
                </Link>
              </p>
              <p className="mt-1 text-[16px] text-ink-muted">
                {[
                  raceLabel(event.organiser.race, event.organiser.gender),
                  event.organiser.age !== null ? `${event.organiser.age} ans` : null,
                  event.organiser.title,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {isOwner ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/evenements/${event.slug}/modifier`}>MODIFIER L'ANNONCE</Link>
                </Button>
                <DeleteContent
                  id={event.id}
                  action={deleteEventAction}
                  title={event.title}
                  question="Supprimer cette annonce ?"
                  consequence="L'annonce quitte l'agenda et la carte, avec sa bannière et les inscriptions déjà prises. Les personnes inscrites ne sont pas prévenues. C'est irréversible."
                  excerpt={event.summary}
                  verb="SUPPRIMER L'ANNONCE"
                />
              </>
            ) : null}
            {canReportContent(user, event.authorId) ? (
              <ReportDialog
                targetType="evenement"
                targetId={event.id}
                targetSlug={event.slug}
                label={`Signaler l'évènement ${event.title}`}
                withLabel
              />
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <dt className="text-[16px] text-ink-muted">{label}</dt>
      <dd className="text-right text-[17px] text-ink">{value}</dd>
    </div>
  );
}
