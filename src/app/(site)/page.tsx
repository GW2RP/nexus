import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CharacterRow } from "@/components/content/character-card";
import { EventCard } from "@/components/content/event-card";
import { RumorItem } from "@/components/content/rumor-item";
import { WeatherBadge } from "@/components/content/weather-badge";
import { MapPreview } from "@/components/map/map-preview";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatLongDate, isoDate } from "@/lib/dates";
import { canContribute, canReportContent } from "@/lib/permissions";
import { SITE_DESCRIPTION, SITE_TAGLINE, buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { cn } from "@/lib/utils";
import heroImage from "@/assets/accueil-hero.webp";
import { listCharacters } from "@/server/queries/characters";
import { listEvents } from "@/server/queries/events";
import { listPlacesForMap } from "@/server/queries/places";
import { listRumors, listRumorsForMap } from "@/server/queries/rumors";
import { getCurrentWeather } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: SITE_TAGLINE,
  description: SITE_DESCRIPTION,
  path: "/",
  keywords: [
    "Guild Wars 2 RP",
    "GW2 roleplay francophone",
    "communauté RP Tyrie",
    "agenda RP Guild Wars 2",
  ],
});

export default async function HomePage() {
  const now = new Date();
  const user = await getCurrentUser();

  const [events, rumors, characters, places, pinnedRumors, weather] = await Promise.all([
    listEvents({ limit: 3, viewer: user }),
    listRumors({ pageSize: 3, viewerId: user?.id ?? null }),
    listCharacters({ pageSize: 4 }),
    listPlacesForMap(),
    listRumorsForMap(),
    getCurrentWeather(),
  ]);

  return (
    <>
      {/* L'accroche porte l'illustration du hub en fond, pleine largeur. Elle
          est toujours de nuit — `data-theme="dark"` y fixe les jetons —, parce
          que l'image l'est : en thème clair, l'encre sombre du parchemin
          disparaîtrait sur son bleu. Le texte se pose sur un voile tiré du fond
          de page, plein sous le texte et ouvert sur le cœur lumineux de
          l'image : c'est ce voile, pas l'image, qui décide de la lisibilité. */}
      <section
        data-theme="dark"
        aria-labelledby="accroche"
        className="relative isolate overflow-hidden border-b-2 border-rule bg-ground text-ink"
      >
        {/* Sur grand écran, l'image ne tient que la droite de l'accroche :
            pleine largeur, son cœur lumineux tombait sous le titre. Elle
            commence là où le texte finit de se lire. Plus étroit, le texte
            prend toute la largeur : l'image descend en bande sous les boutons,
            fondue par le haut, et son cœur s'y montre à découvert. */}
        <div className="absolute inset-x-0 bottom-0 -z-20 h-[380px] [mask-image:linear-gradient(to_bottom,transparent,black_45%)] md:h-[460px] lg:inset-y-0 lg:left-[32%] lg:h-auto lg:[mask-image:none]">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="(min-width: 1024px) 68vw, 100vw"
            className="object-cover object-[50%_45%]"
          />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,var(--ground)_0%,color-mix(in_srgb,var(--ground)_55%,transparent)_55%,transparent_85%)] lg:bg-[linear-gradient(90deg,var(--ground)_0%,var(--ground)_34%,color-mix(in_srgb,var(--ground)_55%,transparent)_48%,transparent_66%)]"
        />
        <div className="mx-auto flex max-w-[1280px] items-center px-gutter-mobile pb-64 pt-12 md:px-gutter-app md:pb-80 lg:min-h-[600px] lg:py-14 xl:px-gutter-desktop">
          <div className="max-w-[560px]">
            <p className="mb-4 eyebrow text-gold-eyebrow">
              UNIVERS GUILD WARS 2 · JEU DE RÔLE
            </p>
            <h1
              id="accroche"
              className="mb-5 font-display text-[36px] font-bold leading-[1.12] text-pretty sm:text-[44px] lg:text-[52px]"
            >
              Le hub du jeu de rôle en Tyrie
            </h1>
            <p className="mb-7 max-w-[520px] text-[19px] leading-[1.55] text-ink-body sm:text-[20px]">
              Registre des personnages, carte vivante, agenda des évènements et tableau des rumeurs
              — tout ce qui fait vivre vos histoires, au même endroit.
            </p>
            {/* La date réelle en premier, la date tyrienne en second. Les deux
                lisent l'heure du serveur de jeu — `toTyrianDate` s'en charge. */}
            <p className="mb-8 meta text-ink-muted">
              <time dateTime={isoDate(now)}>{formatLongDate(now)}</time>
              {" · "}
              <span className="text-gold-eyebrow">{formatTyrianDate(now)}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lead">
                <Link href="/carte">EXPLORER LA CARTE</Link>
              </Button>
              <Button asChild variant="outline" size="lead" className="bg-ground">
                <Link href={user ? "/personnages/nouveau" : "/inscription"}>
                  CRÉER MON PERSONNAGE
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-gutter-mobile pt-11 md:px-gutter-app xl:px-gutter-desktop">
        <section className="pb-11" aria-labelledby="prochains-evenements">
          <SectionHeading
            id="prochains-evenements"
            title="Prochains évènements"
            href="/evenements"
            linkLabel="Voir l'agenda complet"
          />
          {events.length > 0 ? (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-[22px]">
              {events.map((event, index) => (
                // Sur deux colonnes, la troisième scène resterait seule sur sa
                // ligne : l'extrait en montre deux, l'agenda a le reste.
                <div key={event.id} className={cn("grid", index === 2 && "sm:max-lg:hidden")}>
                  <EventCard event={event} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Aucun évènement annoncé"
              action={
                <Button asChild variant="outline">
                  <Link href={user ? "/evenements/nouveau" : "/connexion"}>
                    PROPOSER UN ÉVÈNEMENT
                  </Link>
                </Button>
              }
            />
          )}
        </section>

        <section className="pb-11" aria-labelledby="la-carte">
          <SectionHeading
            id="la-carte"
            title="La carte de Tyrie"
            href="/carte"
            linkLabel="Ouvrir en plein écran"
          />
          <div className="flex flex-col gap-7 lg:flex-row lg:items-stretch">
            <div className="flex-2 lg:basis-0">
              <MapPreview places={places} events={events} rumors={pinnedRumors} />
            </div>
            <div className="flex flex-1 flex-col lg:basis-0">
              {weather.length > 0 ? (
                <div className="mb-5 flex flex-wrap gap-3">
                  {weather.slice(0, 2).map((entry) => (
                    <WeatherBadge key={entry.id} weather={entry} />
                  ))}
                </div>
              ) : null}
              <ul className="mb-5 flex flex-col gap-3">
                <LegendItem shape="round-outline">Tavernes et auberges</LegendItem>
                <LegendItem shape="square-outline">Sièges de guilde</LegendItem>
                <LegendItem shape="round-solid">Évènement en cours</LegendItem>
                <LegendItem shape="round-dashed">Évènement annoncé</LegendItem>
                <LegendItem shape="round-crimson">Rumeur épinglée</LegendItem>
              </ul>
              <Button asChild variant="outline" className="mt-auto">
                <Link href={user ? "/lieux/nouveau" : "/connexion"}>PROPOSER UN LIEU</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-10 pb-10 lg:flex-row lg:gap-10">
          <div className="lg:flex-[1.35] lg:basis-0" aria-labelledby="tableau-rumeurs">
            <SectionHeading
              id="tableau-rumeurs"
              title="Tableau des rumeurs"
              href="/rumeurs"
              linkLabel="Colporter la vôtre"
            />
            {rumors.items.length > 0 ? (
              <ul>
                {rumors.items.map((rumor) => (
                  <RumorItem
                    key={rumor.id}
                    rumor={rumor}
                    canEcho={canContribute(user)}
                    canReport={canReportContent(user, rumor.authorId)}
                  />
                ))}
              </ul>
            ) : (
              <EmptyState title="Le tableau est vide" />
            )}
          </div>

          <div className="lg:flex-1 lg:basis-0" aria-labelledby="au-registre">
            <SectionHeading
              id="au-registre"
              title="Au registre"
              href="/personnages"
              linkLabel="Tout le registre"
            />
            {characters.items.length > 0 ? (
              <ul>
                {characters.items.map((character) => (
                  <CharacterRow key={character.id} character={character} />
                ))}
              </ul>
            ) : (
              <EmptyState title="Le registre est vide" />
            )}
          </div>
        </section>
      </div>
    </>
  );
}

function LegendItem({
  shape,
  children,
}: {
  shape:
    | "round-outline"
    | "square-outline"
    | "round-solid"
    | "round-dashed"
    | "round-crimson";
  children: React.ReactNode;
}) {
  const classes = {
    "round-outline": "rounded-full border-[1.5px] border-gold-eyebrow",
    "square-outline": "border-[1.5px] border-gold-eyebrow",
    "round-solid": "rounded-full bg-crimson",
    "round-dashed": "rounded-full border-[1.5px] border-dashed border-gold-eyebrow",
    "round-crimson": "rounded-full border-[1.5px] border-crimson-edge",
  }[shape];

  return (
    <li className="flex items-center gap-[10px] text-[17px] text-ink-body">
      <span aria-hidden="true" className={`size-[11px] shrink-0 ${classes}`} />
      {children}
    </li>
  );
}
