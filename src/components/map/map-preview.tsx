"use client";

import { useMemo } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { PLACE_TYPE_LABELS, REGION_LABELS } from "@/lib/domain";
import type { EventSummary, PlaceSummary } from "@/server/types";

/** L'aperçu de la carte sur l'accueil : les mêmes tuiles et les mêmes pins que
 *  la carte plein écran, mais on la regarde sans la manipuler. */
export function MapPreview({
  places,
  events,
}: {
  places: PlaceSummary[];
  events: EventSummary[];
}) {
  const pins = useMemo<MapPin[]>(() => {
    const placePins: MapPin[] = places
      .filter((place) => place.coordinates)
      .map((place) => ({
        id: place.id,
        kind: "lieu",
        type: place.type,
        name: place.name,
        meta: [PLACE_TYPE_LABELS[place.type], REGION_LABELS[place.region]].join(" · "),
        href: `/lieux/${place.slug}`,
        x: place.coordinates!.x,
        y: place.coordinates!.y,
        state: "lieu",
      }));

    const eventPins: MapPin[] = events
      .filter((event) => event.coordinates)
      .map((event) => ({
        id: `evenement-${event.id}`,
        kind: "evenement",
        type: event.type,
        name: event.title,
        meta: event.locationLabel,
        href: `/evenements/${event.slug}`,
        x: event.coordinates!.x,
        y: event.coordinates!.y,
        state: event.liveStatus === "en-cours" ? "en-cours" : "annonce",
      }));

    return [...placePins, ...eventPins];
  }, [places, events]);

  return (
    <div className="framed">
      <div className="aspect-[706/360] w-full overflow-hidden border border-rule">
        <MapCanvas pins={pins} interactive={false} className="size-full bg-map-land" />
      </div>
    </div>
  );
}
