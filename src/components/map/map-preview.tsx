"use client";

import Link from "next/link";
import { useMemo } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { PLACE_TYPE_LABELS, REGION_LABELS } from "@/lib/domain";
import type { EventSummary, PlaceSummary } from "@/server/types";

/** L'aperçu de la carte sur l'accueil : les mêmes tuiles et les mêmes pins que
 *  la carte plein écran, mais on la regarde sans la manipuler.
 *
 *  Le lien qui la recouvre est ce qui la rend cliquable : l'aperçu n'a ni zoom
 *  ni glissé, donc un clic dessus n'attendait rien — il mène à la carte. C'est
 *  un vrai lien par-dessus, et non un `onClick` sur le cadre : il s'ouvre dans
 *  un onglet, se copie, et s'annonce comme un lien. */
export function MapPreview({
  places,
  events,
  href = "/carte",
}: {
  places: PlaceSummary[];
  events: EventSummary[];
  /** Là où mène le clic. */
  href?: string;
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
      <div className="relative aspect-[706/360] w-full overflow-hidden border border-rule">
        <MapCanvas pins={pins} interactive={false} className="size-full bg-map-land" />
        {/* Au-dessus des calques de Leaflet — la couche des pins monte à 600 —
            sans quoi un pin volerait le clic au lien. */}
        <Link
          href={href}
          aria-label="Ouvrir la carte de Tyrie"
          className="absolute inset-0 z-[700] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        />
      </div>
    </div>
  );
}
