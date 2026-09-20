import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EventRow } from "@/components/content/event-row";
import { PlaceTabs } from "@/components/content/place-tabs";
import { WeatherBadge } from "@/components/content/weather-badge";
import { ReportDialog } from "@/components/report-dialog";
import { DeleteContent } from "@/components/content/delete-content";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { PlaceTypeChip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { FramedMedia } from "@/components/ui/framed-media";
import { RichText } from "@/components/ui/rich-text";
import { SectionHeading } from "@/components/ui/section-heading";
import { PLACE_TYPE_LABELS, REGION_LABELS } from "@/lib/domain";
import { canEditContent, canEditPlace, canReportContent } from "@/lib/permissions";
import { SITE_URL, breadcrumbJsonLd, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deletePlaceAction } from "@/server/actions/places";
import { listEvents } from "@/server/queries/events";
import { getPlaceBySlug } from "@/server/queries/places";
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
  const place = await getPlaceBySlug(slug);
  if (!place) {
    return buildMetadata({
      title: "Lieu introuvable",
      description: "Ce lieu n'est plus au registre.",
      path: `/lieux/${slug}`,
      noIndex: true,
    });
  }

  return buildMetadata({
    title: place.name,
    description:
      place.summary ??
      `${place.name} — ${PLACE_TYPE_LABELS[place.type]} en ${REGION_LABELS[place.region]}, au registre des lieux du hub GW2RP Nexus.`,
    path: `/lieux/${place.slug}`,
    image: place.bannerUrl,
    imageAlt: place.bannerAlt ?? `Bannière de ${place.name}`,
    type: "article",
    publishedTime: place.createdAt,
    modifiedTime: place.updatedAt,
    authors: place.author ? [place.author.name] : undefined,
    keywords: [place.name, PLACE_TYPE_LABELS[place.type], REGION_LABELS[place.region]],
  });
}

export default async function PlacePage({ params }: Props) {
  const { slug } = await params;
  const [place, user] = await Promise.all([getPlaceBySlug(slug), getCurrentUser()]);
  if (!place) notFound();

  const [events, weather] = await Promise.all([
    listEvents({ placeId: place.id, limit: 6, viewer: user }),
    // Le lieu a des coordonnées : on prend le temps de sa cellule, pas la
    // moyenne de sa région. La brume d'un marais n'est pas celle de la Kryte.
    place.coordinates
      ? getWeatherAt(place.coordinates, place.region)
      : getWeatherForRegion(place.region),
  ]);

  const managerIds = place.managers.map((manager) => manager.id);
  // Un co-gérant modifie le lieu ; seul son auteur peut le retirer du registre.
  const canEdit = canEditPlace(user, { authorId: place.authorId, managerIds });
  const canDelete = canEditContent(user, place.authorId);

  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: place.name,
    url: `${SITE_URL}/lieux/${place.slug}`,
    description: place.summary ?? undefined,
    image: place.bannerUrl ?? undefined,
    address: {
      "@type": "PostalAddress",
      addressLocality: place.district ?? undefined,
      addressRegion: REGION_LABELS[place.region],
    },
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(placeJsonLd)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Lieux", path: "/lieux" },
            { name: place.name, path: `/lieux/${place.slug}` },
          ]),
        )}
      />

      <Breadcrumb
        items={[
          { label: "Lieux", href: "/lieux" },
          { label: REGION_LABELS[place.region], href: `/lieux?region=${place.region}` },
          { label: place.name },
        ]}
      />

      <FramedMedia
        src={place.bannerUrl}
        alt={place.bannerAlt ?? `Bannière de ${place.name}`}
        placeholder="BANNIÈRE DU LIEU"
        dimensions={place.bannerUrl ? undefined : "1600 × 500"}
        aspect="16 / 5"
      >
        <PlaceTypeChip type={place.type} onImage className="absolute left-4 top-4" />
      </FramedMedia>

      <div className="mt-7 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
            {place.name}
          </h1>
          <p className="mt-3 text-[18px] leading-[1.55] text-ink-muted">
            {[place.district, REGION_LABELS[place.region]].filter(Boolean).join(", ")}
            {place.keepers.length > 0 ? (
              <>
                {" · tenu par "}
                {place.keepers.map((keeper, index) => (
                  <span key={keeper.id}>
                    {index > 0 ? (index === place.keepers.length - 1 ? " et " : ", ") : null}
                    <Link
                      href={`/personnages/${keeper.slug}`}
                      className="text-crimson-ink underline-offset-4 hover:underline"
                    >
                      {keeper.name}
                    </Link>
                  </span>
                ))}
              </>
            ) : null}
            {place.access ? ` · ${place.access.toLowerCase()}` : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <Button asChild variant="outline">
              <Link href={`/lieux/${place.slug}/modifier`}>MODIFIER LA FICHE</Link>
            </Button>
          ) : null}
          {canDelete ? (
            <DeleteContent
              id={place.id}
              action={deletePlaceAction}
              title={place.name}
              question="Supprimer ce lieu ?"
              consequence="Le lieu quitte le registre et la carte, avec sa bannière et son plan. Les évènements qui s'y tenaient restent à l'agenda, sans lieu. C'est irréversible."
              excerpt={place.summary}
              verb="SUPPRIMER LE LIEU"
            />
          ) : null}
          {canReportContent(user, place.authorId) ? (
            <ReportDialog
              targetType="lieu"
              targetId={place.id}
              targetSlug={place.slug}
              label={`Signaler le lieu ${place.name}`}
              withLabel
            />
          ) : null}
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          {place.description ? (
            <section className="mb-10">
              <RichText text={place.description} />
            </section>
          ) : null}

          <section className="mb-10" aria-labelledby="les-lieux">
            <SectionHeading id="les-lieux" title="Les lieux" />
            <PlaceTabs place={place} />
          </section>

          <section aria-labelledby="evenements-ici">
            <SectionHeading
              id="evenements-ici"
              title="Évènements à venir ici"
              href="/evenements"
              linkLabel="Tout l'agenda"
            />
            {events.length > 0 ? (
              <ul>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Rien d'annoncé ici"
              />
            )}
          </section>
        </div>

        <aside className="lg:w-[320px] lg:shrink-0">
          <section className="mb-8" aria-labelledby="en-bref">
            <SectionHeading id="en-bref" title="En bref" compact />
            <dl className="flex flex-col">
              <Fact label="Type" value={PLACE_TYPE_LABELS[place.type]} />
              <Fact label="Région" value={REGION_LABELS[place.region]} />
              <Fact label="Quartier" value={place.district} />
              <Fact label="Accès" value={place.access} />
              <Fact label="Fiche tenue par" value={place.author?.name} />
              <Fact
                label={place.managers.length > 1 ? "Co-gérants" : "Co-gérant"}
                value={
                  place.managers.length > 0
                    ? place.managers.map((manager) => manager.name).join(", ")
                    : null
                }
              />
            </dl>
          </section>

          {weather ? (
            <section aria-labelledby="meteo-locale">
              <SectionHeading
                id="meteo-locale"
                title={place.coordinates ? "Météo sur place" : "Météo sur la région"}
                compact
              />
              <WeatherBadge weather={weather} />
            </section>
          ) : null}
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
