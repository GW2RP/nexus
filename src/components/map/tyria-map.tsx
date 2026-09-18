"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import { markerHtml, type MarkerState } from "@/components/map/map-marker-html";
import type { EventType, PlaceType } from "@/lib/domain";
import {
  CLAMPED_VIEW,
  COORDINATE_ZOOM,
  DEFAULT_VIEW,
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

type Rect = { left: number; top: number; right: number; bottom: number };

/** Un rectangle en pixels de continent, converti en bornes Leaflet. */
function toBounds(map: L.Map, rect: Rect): L.LatLngBounds {
  return L.latLngBounds(
    map.unproject([rect.left, rect.bottom], COORDINATE_ZOOM),
    map.unproject([rect.right, rect.top], COORDINATE_ZOOM),
  );
}

/** La carte de Tyrie. Leaflet en `CRS.Simple` sur les tuiles du jeu, monté
 *  côté client uniquement. À la sélection, les autres pins passent à 65 %
 *  d'opacité — ils ne disparaissent pas. */
export function TyriaMap({
  pins,
  selectedId,
  onSelect,
  onPick,
  interactive = true,
  className,
}: {
  pins: MapPin[];
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Un clic sur la carte renvoie le point, en pixels de continent. */
  onPick?: (point: { x: number; y: number }) => void;
  /** Un aperçu se regarde : pas de zoom à la molette, pas de glissé. */
  interactive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onPickRef.current = onPick;
  }, [onSelect, onPick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      zoomControl: false,
      attributionControl: false,
      keyboard: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      touchZoom: interactive,
    });

    // Pas de `bounds` sur la couche : le cadrage est déjà tenu par `maxBounds`,
    // et le moindre écart y ferait sauter des tuiles au bord du champ.
    L.tileLayer(TILE_URL, {
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      noWrap: true,
    }).addTo(map);

    if (interactive) {
      L.control.zoom({ position: "bottomright" }).addTo(map);
    }
    L.control
      .attribution({ position: "bottomright", prefix: false })
      .addAttribution(TILE_ATTRIBUTION)
      .addTo(map);

    // Hors de `clamped_view`, les tuiles sont vides : on n'y laisse pas aller.
    map.setMaxBounds(toBounds(map, CLAMPED_VIEW).pad(0.05));
    map.fitBounds(toBounds(map, DEFAULT_VIEW));

    if (interactive) {
      map.on("click", (event) => {
        // Un clic hors d'un pin ferme le panneau de détail, et pose le point
        // quand la carte sert à choisir un emplacement.
        onSelectRef.current?.(null);
        const point = map.project(event.latlng, COORDINATE_ZOOM);
        onPickRef.current?.({ x: Math.round(point.x), y: Math.round(point.y) });
      });
    }

    // Le conteneur est dimensionné par la mise en page, souvent après le montage :
    // sans cela Leaflet garde la taille qu'il a mesurée trop tôt, et les tuiles
    // des zones découvertes ensuite ne sont jamais demandées.
    let fitted = false;
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      // Le premier redimensionnement est celui de la mise en page qui se pose :
      // on recadre une fois, puis on laisse la vue à qui la manipule.
      if (!fitted && container.clientWidth > 0) {
        map.fitBounds(toBounds(map, DEFAULT_VIEW), { animate: false });
        fitted = true;
      }
    });
    observer.observe(container);

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      markers.clear();
    };
  }, [interactive]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    for (const pin of pins) {
      const state: MarkerState = pin.id === selectedId ? "selectionne" : pin.state;
      const size = state === "selectionne" ? 44 : 34;

      const marker = L.marker(map.unproject([pin.x, pin.y], COORDINATE_ZOOM), {
        icon: L.divIcon({
          html: markerHtml(pin.type, state),
          className: "gw2rp-pin",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        }),
        keyboard: interactive,
        interactive,
        title: pin.name,
        alt: `${pin.name} — ${pin.meta}`,
        // Les autres pins s'effacent sans disparaître quand un pin est choisi.
        opacity: selectedId && pin.id !== selectedId ? 0.65 : 1,
        zIndexOffset: pin.id === selectedId ? 1000 : 0,
      });

      if (interactive) {
        marker.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          onSelectRef.current?.(pin.id);
        });
        marker.on("keypress", () => onSelectRef.current?.(pin.id));
      }

      marker.addTo(map);
      markersRef.current.set(pin.id, marker);
    }
  }, [pins, selectedId, interactive]);

  // Centrer sur le pin choisi quand la sélection vient de la liste latérale.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const pin = pins.find((item) => item.id === selectedId);
    if (!pin) return;
    map.panTo(map.unproject([pin.x, pin.y], COORDINATE_ZOOM));
  }, [selectedId, pins]);

  return (
    <div
      ref={containerRef}
      role={interactive ? "application" : "img"}
      aria-label="Carte de Tyrie"
      className={className}
    />
  );
}

export default TyriaMap;
