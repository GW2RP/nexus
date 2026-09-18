"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { PlaceGlyph, WeatherGlyph } from "@/components/type-glyph";
import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  REGION_LABELS,
  WEATHER_LABELS,
  type PlaceType,
} from "@/lib/domain";
import { TILE_ATTRIBUTION } from "@/lib/map";
import { cn } from "@/lib/utils";
import type { EventSummary, PlaceSummary, WeatherEntry } from "@/server/types";

export function MapExplorer({
  places,
  events,
  weather,
  initialPlaceSlug,
  canPropose,
}: {
  places: PlaceSummary[];
  events: EventSummary[];
  weather: WeatherEntry[];
  initialPlaceSlug?: string;
  canPropose: boolean;
}) {
  const [tab, setTab] = useState<"lieux" | "evenements">("lieux");
  const [typeFilter, setTypeFilter] = useState<PlaceType | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => places.find((place) => place.slug === initialPlaceSlug)?.id ?? null,
  );

  const visiblePlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return places.filter((place) => {
      if (typeFilter && place.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        place.name.toLowerCase().includes(needle) ||
        (place.district ?? "").toLowerCase().includes(needle)
      );
    });
  }, [places, typeFilter, query]);

  const pins = useMemo<MapPin[]>(() => {
    const placePins: MapPin[] = visiblePlaces
      .filter((place) => place.coordinates)
      .map((place) => ({
        id: place.id,
        kind: "lieu",
        type: place.type,
        name: place.name,
        meta: [PLACE_TYPE_LABELS[place.type], place.district, REGION_LABELS[place.region]]
          .filter(Boolean)
          .join(" · "),
        href: `/lieux/${place.slug}`,
        x: place.coordinates!.x,
        y: place.coordinates!.y,
        state: "lieu",
      }));

    // L'état vient du serveur : « en cours » ne doit pas changer à l'hydratation.
    const eventPins: MapPin[] = events
      .filter((event) => event.coordinates)
      .map((event) => ({
        id: `evenement-${event.id}`,
        kind: "evenement" as const,
        type: event.type,
        name: event.title,
        meta: event.locationLabel,
        href: `/evenements/${event.slug}`,
        x: event.coordinates!.x,
        y: event.coordinates!.y,
        state: event.liveStatus === "en-cours" ? ("en-cours" as const) : ("annonce" as const),
      }));

    return [...placePins, ...eventPins];
  }, [visiblePlaces, events]);

  const selectedPlace = places.find((place) => place.id === selectedId) ?? null;
  const selectedEvent =
    events.find((event) => `evenement-${event.id}` === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100dvh-82px)] min-h-[560px] flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b-2 border-rule bg-surface lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r-2">
        <div className="flex border-b border-rule">
          <TabButton active={tab === "lieux"} onClick={() => setTab("lieux")}>
            LIEUX · {places.length}
          </TabButton>
          <TabButton active={tab === "evenements"} onClick={() => setTab("evenements")}>
            ÉVÈNEMENTS · {events.length}
          </TabButton>
        </div>

        <div className="flex flex-col gap-4 border-b border-rule p-gutter-app">
          <div className="flex items-center gap-2 border border-rule bg-surface-inset px-3">
            <SearchIcon size={16} className="text-ink-muted" />
            <Label htmlFor="recherche-carte" hidden>
              Rechercher sur la carte
            </Label>
            <input
              id="recherche-carte"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Taverne, guilde, ruine…"
              className="min-h-tap w-full bg-transparent text-[17px] text-ink placeholder:text-ink-subtle focus-visible:outline-none"
            />
          </div>

          {tab === "lieux" ? (
            <fieldset className="flex flex-wrap gap-2 border-0 p-0">
              <legend className="sr-only">Filtrer par type de lieu</legend>
              <FilterButton active={!typeFilter} onClick={() => setTypeFilter(null)}>
                TOUS
              </FilterButton>
              {PLACE_TYPES.map((type) => (
                <FilterButton
                  key={type}
                  active={typeFilter === type}
                  onClick={() => setTypeFilter(type)}
                >
                  {PLACE_TYPE_LABELS[type].toLocaleUpperCase("fr-FR")}
                </FilterButton>
              ))}
            </fieldset>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "lieux" ? (
            visiblePlaces.length > 0 ? (
              <ul>
                {visiblePlaces.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(place.id)}
                      aria-pressed={selectedId === place.id}
                      className={cn(
                        "flex w-full items-center gap-3 border-b border-hairline px-gutter-app py-4 text-left",
                        selectedId === place.id
                          ? "bg-surface-selected"
                          : "hover:bg-surface-selected",
                      )}
                    >
                      <span className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-gold bg-surface text-gold-ink">
                        <PlaceGlyph type={place.type} size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display text-[18px] text-ink">
                          {place.name}
                        </span>
                        <span className="block text-[16px] text-ink-muted">
                          {[PLACE_TYPE_LABELS[place.type], place.district]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {place.upcomingEventCount > 0 ? (
                          <span className="block text-[15px] text-crimson-ink">
                            {place.upcomingEventCount} évènement
                            {place.upcomingEventCount > 1 ? "s" : ""} à venir
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-gutter-app py-8 text-[17px] text-ink-muted">
                Aucun lieu ne répond à ce filtre. Retirez-en un, ou proposez le vôtre.
              </p>
            )
          ) : events.length > 0 ? (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(`evenement-${event.id}`)}
                    aria-pressed={selectedId === `evenement-${event.id}`}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-hairline px-gutter-app py-4 text-left",
                      selectedId === `evenement-${event.id}`
                        ? "bg-surface-selected"
                        : "hover:bg-surface-selected",
                    )}
                  >
                    <span className="font-display text-[18px] text-ink">{event.title}</span>
                    <span className="text-[16px] text-ink-muted">{event.locationLabel}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-gutter-app py-8 text-[17px] text-ink-muted">
              Aucun évènement n'est annoncé sur la carte pour l'instant.
            </p>
          )}
        </div>

        <div className="border-t border-rule p-gutter-app">
          <p className="mb-3 text-[15px] text-ink-muted">
            {tab === "lieux"
              ? `${visiblePlaces.length} sur ${places.length} lieux`
              : `${events.length} évènement${events.length > 1 ? "s" : ""}`}
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href={canPropose ? "/lieux/nouveau" : "/connexion"}>PROPOSER UN LIEU</Link>
          </Button>
          <Link
            href="/meteo"
            className="mt-3 inline-block text-[16px] text-crimson-ink underline-offset-4 hover:underline"
          >
            Couches et météo →
          </Link>
        </div>
      </aside>

      <div className="relative min-h-[420px] flex-1">
        <MapCanvas
          pins={pins}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="size-full bg-map-land"
        />

        {weather.length > 0 ? (
          <div className="pointer-events-none absolute left-4 top-4 z-[500] flex flex-col gap-2">
            {weather.map((entry) => (
              <span
                key={entry.id}
                className="inline-flex items-center gap-2 border-2 border-rule bg-surface px-3 py-2 text-[15px] text-ink-body"
              >
                <WeatherGlyph condition={entry.condition} size={18} className="text-rain" />
                {WEATHER_LABELS[entry.condition]} sur {REGION_LABELS[entry.region]}
              </span>
            ))}
          </div>
        ) : null}

        {selectedPlace ? (
          <DetailPanel
            title={selectedPlace.name}
            meta={[
              PLACE_TYPE_LABELS[selectedPlace.type],
              selectedPlace.district,
              REGION_LABELS[selectedPlace.region],
            ]
              .filter(Boolean)
              .join(" · ")}
            note={
              selectedPlace.upcomingEventCount > 0
                ? `${selectedPlace.upcomingEventCount} évènement${
                    selectedPlace.upcomingEventCount > 1 ? "s" : ""
                  } à venir`
                : null
            }
            href={`/lieux/${selectedPlace.slug}`}
            onClose={() => setSelectedId(null)}
          />
        ) : selectedEvent ? (
          <DetailPanel
            title={selectedEvent.title}
            meta={selectedEvent.locationLabel}
            note={`${selectedEvent.registeredCount} inscrit${
              selectedEvent.registeredCount > 1 ? "s" : ""
            }`}
            href={`/evenements/${selectedEvent.slug}`}
            onClose={() => setSelectedId(null)}
          />
        ) : null}

        <p className="pointer-events-none absolute bottom-2 left-4 z-[500] max-w-[60ch] text-[13px] text-ink-subtle lg:hidden">
          {TILE_ATTRIBUTION}
        </p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex-1 border-r border-rule px-4 py-4 font-display text-[12px] font-semibold uppercase tracking-[1.6px] last:border-r-0",
        active ? "bg-gold-ink text-on-crimson" : "text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-tap items-center border px-4 py-[11px] font-display text-[11px] font-medium uppercase tracking-[1.4px]",
        active
          ? "border-gold-ink bg-gold-ink text-on-crimson"
          : "border-chip-edge text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}

/** L'infobulle du pin choisi : cartouche bordé 2 px `gold`, titre, méta, actions. */
function DetailPanel({
  title,
  meta,
  note,
  href,
  onClose,
}: {
  title: string;
  meta: string;
  note: string | null;
  href: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-4 bottom-4 z-[600] w-auto border-2 border-gold bg-surface p-5 sm:left-4 sm:w-[318px]">
      <h2 className="font-display text-[21px] font-semibold leading-[1.25]">{title}</h2>
      <p className="mt-1 text-[16px] text-ink-muted">{meta}</p>
      {note ? <p className="mt-1 text-[16px] text-crimson-ink">{note}</p> : null}
      <div className="mt-4 flex gap-3">
        <Button asChild size="sm">
          <Link href={href}>VOIR LA FICHE</Link>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          FERMER
        </Button>
      </div>
    </div>
  );
}
