"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import { markerHtml, type MarkerState } from "@/components/map/map-marker-html";
import type { EventType, PlaceType } from "@/lib/domain";
import {
  CONTINENT_SIZE,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";

export type MapPin = {
  id: string;
  kind: "lieu" | "evenement";
  type: PlaceType | EventType;
  name: string;
  meta: string;
  href: string;
  x: number;
  y: number;
  state: MarkerState;
};

/** La carte plein écran. Leaflet en `CRS.Simple` sur les tuiles du jeu, monté
 *  côté client uniquement. À la sélection, les autres pins passent à 65 %
 *  d'opacité — ils ne disparaissent pas. */
export function TyriaMap({
  pins,
  selectedId,
  onSelect,
  className,
}: {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);

  // Le rappel est gardé dans une ref pour que les marqueurs déjà posés appellent
  // toujours la dernière version, sans remonter la carte à chaque rendu.
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      // Le clavier doit atteindre la carte : le focus y est visible.
      keyboard: true,
    });

    L.tileLayer(TILE_URL, {
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      noWrap: true,
      bounds: L.latLngBounds(
        map.unproject([0, CONTINENT_SIZE], MAP_MAX_ZOOM),
        map.unproject([CONTINENT_SIZE, 0], MAP_MAX_ZOOM),
      ),
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addAttribution(TILE_ATTRIBUTION)
      .addTo(map);

    map.setMaxBounds(
      L.latLngBounds(
        map.unproject([0, CONTINENT_SIZE], MAP_MAX_ZOOM),
        map.unproject([CONTINENT_SIZE, 0], MAP_MAX_ZOOM),
      ),
    );
    map.setView(map.unproject([DEFAULT_CENTER.x, DEFAULT_CENTER.y], MAP_MAX_ZOOM), DEFAULT_ZOOM);

    // Un clic hors d'un pin ferme le panneau de détail.
    map.on("click", () => onSelectRef.current?.(null));

    mapRef.current = map;

    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    for (const pin of pins) {
      const state: MarkerState = pin.id === selectedId ? "selectionne" : pin.state;
      const size = state === "selectionne" ? 44 : 34;

      const marker = L.marker(map.unproject([pin.x, pin.y], MAP_MAX_ZOOM), {
        icon: L.divIcon({
          html: markerHtml(pin.type, state),
          className: "gw2rp-pin",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        keyboard: true,
        title: pin.name,
        alt: `${pin.name} — ${pin.meta}`,
        // Les autres pins s'effacent sans disparaître quand un pin est choisi.
        opacity: selectedId && pin.id !== selectedId ? 0.65 : 1,
        zIndexOffset: pin.id === selectedId ? 1000 : 0,
      });

      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        onSelectRef.current?.(pin.id);
      });
      marker.on("keypress", () => onSelectRef.current?.(pin.id));

      marker.addTo(map);
      markersRef.current.set(pin.id, marker);
    }
  }, [pins, selectedId]);

  // Centrer sur le pin choisi quand la sélection vient de la liste latérale.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const pin = pins.find((item) => item.id === selectedId);
    if (!pin) return;
    map.panTo(map.unproject([pin.x, pin.y], MAP_MAX_ZOOM));
  }, [selectedId, pins]);

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label="Carte de Tyrie"
      className={className}
    />
  );
}

export default TyriaMap;
