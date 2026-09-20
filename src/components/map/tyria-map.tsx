"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";

import {
  markerHtml,
  phenomeneMarkerHtml,
  sondeMarkerHtml,
  type MarkerState,
} from "@/components/map/map-marker-html";
import type { EventType, PlaceType } from "@/lib/domain";
import { CELL_SIZE, cellRect } from "@/lib/weather/grid";
import type { Phenomene } from "@/lib/weather/phenomena";
import type { MapTone } from "@/lib/weather/tones";
import {
  CLAMPED_VIEW,
  COORDINATE_ZOOM,
  clampX,
  clampY,
  DEFAULT_VIEW,
  MAP_MAX_ZOOM,
  MAP_MIN_ZOOM,
  TILE_ATTRIBUTION,
  TILE_URL,
} from "@/lib/map";

/** De combien une flèche du clavier déplace un sommet, en pixels de continent.
 *  Une cellule de simulation, parce que c'est l'unité qui décide si la zone
 *  couvre un centre de cellule ou non — et `Maj` pour affiner au dixième. */
const PAS_CLAVIER = CELL_SIZE;
const PAS_CLAVIER_FIN = CELL_SIZE / 10;

/** Ce qui sépare deux pins posés au même endroit. Un peu moins que leur
 *  diamètre : ils se touchent sans se couvrir, et la rangée reste lisible comme
 *  un groupe plutôt que comme des pins éparpillés. */
const ESPACEMENT_GRAPPE = 28;

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

/** Un polygone posé sur la carte : une zone de terrain, ou le tracé en cours. */
export type MapShape = {
  id: string;
  points: { x: number; y: number }[];
  tone: MapTone;
  /** Le tracé en cours montre ses sommets, une zone enregistrée non. */
  showVertices?: boolean;
  /** Le tracé qu'on modifie laisse saisir ses sommets. Sans ça, ils restent
   *  inertes : une zone qu'on regarde n'a pas à se laisser déformer. */
  draggableVertices?: boolean;
};

/**
 * Une tache de ciel : un seul tracé pour tout un phénomène, et son symbole au
 * milieu. Le premier anneau la cerne, les suivants la percent.
 */
export type MapArea = {
  id: string;
  anneaux: { x: number; y: number }[][];
  tone: MapTone;
  fill: number;
  /** Le phénomène, pour choisir le symbole et l'annoncer. */
  phenomene: Phenomene;
  libelle: string;
  centre: { x: number; y: number };
};

/** Le point sondé, s'il y en a un. */
export type MapProbe = { x: number; y: number };

/** Une suite de cellules voisines d'une même ligne, d'une seule teinte.
 *
 *  Pas une cellule : à 143 360 cellules, un rectangle Leaflet par cellule met
 *  onze secondes à se poser. Comme ces rectangles n'ont pas de trait
 *  (`stroke: false`), deux cellules voisines de même teinte ne se distinguent
 *  déjà pas — les recoudre en une ne change donc rien à l'image, seulement au
 *  nombre de calques. */
export type MapCellRun = {
  /** La première cellule de la suite. */
  index: number;
  /** Combien de cellules elle couvre, vers la droite, sur la même ligne. */
  length: number;
  tone: MapTone;
  /** De 0 à 1. */
  fill: number;
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
  shapes,
  areas,
  cells,
  probe,
  selectedId,
  onSelect,
  onPick,
  onVertexMove,
  initialFrame,
  interactive = true,
  className,
}: {
  pins: MapPin[];
  /** Les zones de terrain, sous les pins. */
  shapes?: MapShape[];
  /** Le calque météo : une tache par phénomène, recousue. */
  areas?: MapArea[];
  /** La grille cuite, cellule par cellule. L'administration en a besoin pour
   *  voir la maille ; le hub, non — il voit des zones. */
  cells?: MapCellRun[];
  /** Le point sondé, marqué d'une croix. */
  probe?: MapProbe | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Un clic sur la carte renvoie le point, en pixels de continent. */
  onPick?: (point: { x: number; y: number }) => void;
  /** Un sommet déplacé — au glissé ou aux flèches — renvoie son rang et sa
   *  nouvelle position, déjà bornée au continent. */
  onVertexMove?: (rank: number, point: { x: number; y: number }) => void;
  /** Le cadrage d'ouverture, en pixels de continent, à la place de la vue par
   *  défaut. L'éditeur d'une zone s'en sert : sans lui, la carte s'ouvre au
   *  cœur de la Tyrie et le tracé qu'on vient modifier peut se trouver
   *  entièrement hors du cadre — ses sommets ne sont alors ni visibles ni
   *  saisissables. */
  initialFrame?: { left: number; top: number; right: number; bottom: number } | null;
  /** Un aperçu se regarde : pas de zoom à la molette, pas de glissé. */
  interactive?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef(new Map<string, L.Marker>());
  const shapesRef = useRef<L.Layer[]>([]);
  const cellsRef = useRef<L.Layer[]>([]);
  const areasRef = useRef<L.Layer[]>([]);
  const probeRef = useRef<L.Layer | null>(null);
  const onSelectRef = useRef(onSelect);
  const onPickRef = useRef(onPick);
  const onVertexMoveRef = useRef(onVertexMove);
  // Le cadrage d'ouverture n'est lu qu'au montage : le garder dans une ref
  // évite de remonter la carte entière si l'appelant en recalcule un.
  const initialFrameRef = useRef(initialFrame);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onPickRef.current = onPick;
    onVertexMoveRef.current = onVertexMove;
  }, [onSelect, onPick, onVertexMove]);

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
    const cadre = initialFrameRef.current ?? DEFAULT_VIEW;
    map.fitBounds(toBounds(map, cadre));

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
        map.fitBounds(toBounds(map, initialFrameRef.current ?? DEFAULT_VIEW), { animate: false });
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
      shapesRef.current = [];
      cellsRef.current = [];
    };
  }, [interactive]);

  // Les zones de terrain. `interactive: false` est obligatoire : un polygone qui
  // intercepte les clics empêcherait `map.on("click")` de se déclencher, et
  // l'éditeur cesserait de poser des sommets dès le troisième.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of shapesRef.current) layer.remove();
    shapesRef.current = [];

    for (const shape of shapes ?? []) {
      if (shape.points.length < 2) continue;
      const polygon = L.polygon(
        shape.points.map((point) => map.unproject([point.x, point.y], COORDINATE_ZOOM)),
        {
          className: `gw2rp-zone gw2rp-zone--${shape.tone}${
            shape.showVertices ? " gw2rp-zone--trace" : ""
          }`,
          interactive: false,
          weight: 2,
        },
      );
      polygon.addTo(map);
      shapesRef.current.push(polygon);

      if (!shape.showVertices) continue;
      const saisissable = Boolean(shape.draggableVertices);
      shape.points.forEach((point, rank) => {
        const marker = L.marker(map.unproject([point.x, point.y], COORDINATE_ZOOM), {
          icon: L.divIcon({
            html: `<span>${rank + 1}</span>`,
            className: "gw2rp-vertex",
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
          // Un sommet qu'on peut saisir doit recevoir les clics ; un sommet
          // qu'on regarde ne doit pas les voler à la carte, sans quoi l'éditeur
          // cesserait de poser des sommets dès qu'on viserait près d'un autre.
          interactive: saisissable,
          keyboard: saisissable,
          draggable: saisissable,
          title: saisissable ? `Sommet ${rank + 1}` : undefined,
          alt: saisissable ? `Sommet ${rank + 1}` : undefined,
          zIndexOffset: 500,
        });

        if (saisissable) {
          const deplace = (x: number, y: number) =>
            onVertexMoveRef.current?.(rank, { x: clampX(Math.round(x)), y: clampY(Math.round(y)) });

          // Le relâché seulement : à chaque `drag`, l'état remonterait au
          // formulaire, qui re-rendrait la liste des sommets et retirerait de
          // la carte le marqueur qu'on a sous le doigt.
          marker.on("dragend", () => {
            const projete = map.project(marker.getLatLng(), COORDINATE_ZOOM);
            deplace(projete.x, projete.y);
          });

          // Le glissé est à la souris ce que les flèches sont au clavier : sans
          // elles, un sommet posé ne se corrigerait qu'à la souris.
          marker.on("keydown", (event) => {
            const touche = (event as unknown as { originalEvent: KeyboardEvent }).originalEvent;
            const pas = touche.shiftKey ? PAS_CLAVIER_FIN : PAS_CLAVIER;
            const ecart: Record<string, [number, number]> = {
              ArrowLeft: [-pas, 0],
              ArrowRight: [pas, 0],
              ArrowUp: [0, -pas],
              ArrowDown: [0, pas],
            };
            const delta = ecart[touche.key];
            if (!delta) return;
            touche.preventDefault();
            L.DomEvent.stopPropagation(event);
            const projete = map.project(marker.getLatLng(), COORDINATE_ZOOM);
            deplace(projete.x + delta[0], projete.y + delta[1]);
          });

          // Un clic sur un sommet ne pose pas un sommet de plus par-dessus.
          marker.on("click", (event) => L.DomEvent.stopPropagation(event));
        }

        marker.addTo(map);
        shapesRef.current.push(marker);
      });
    }
  }, [shapes]);

  // Le calque météo : une tache par phénomène, recousue en un seul tracé, avec
  // son symbole au milieu. Une grille dit sa maille ; une zone dit le temps.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of areasRef.current) layer.remove();
    areasRef.current = [];

    for (const area of areas ?? []) {
      if (area.anneaux.length === 0) continue;
      const polygon = L.polygon(
        area.anneaux.map((anneau) =>
          anneau.map((point) => map.unproject([point.x, point.y], COORDINATE_ZOOM)),
        ),
        {
          className: `gw2rp-tache gw2rp-tache--${area.tone}`,
          fillOpacity: area.fill,
          interactive: false,
          weight: 2,
        },
      );
      polygon.addTo(map);
      areasRef.current.push(polygon);

      const marque = L.marker(map.unproject([area.centre.x, area.centre.y], COORDINATE_ZOOM), {
        icon: L.divIcon({
          html: phenomeneMarkerHtml(area.phenomene),
          className: `gw2rp-signe gw2rp-signe--${area.tone}`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        interactive: false,
        keyboard: false,
        alt: area.libelle,
      });
      marque.addTo(map);
      areasRef.current.push(marque);
    }
  }, [areas]);

  // Le repère de la sonde. Une croix, pas un pin : on ne pose rien, on relève.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    probeRef.current?.remove();
    probeRef.current = null;
    if (!probe) return;

    const marque = L.marker(map.unproject([probe.x, probe.y], COORDINATE_ZOOM), {
      icon: L.divIcon({
        html: sondeMarkerHtml(),
        className: "gw2rp-sonde",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      }),
      interactive: false,
      keyboard: false,
    });
    marque.addTo(map);
    probeRef.current = marque;
  }, [probe]);

  // La grille cuite, un rectangle par **suite** de cellules de même teinte —
  // celles que l'appelant passe, et lui seul : l'administration écarte la
  // plaine, donc le compte suit les zones dessinées et non la taille de la
  // grille. Mesuré à la maille de 256 px : une cellule par rectangle faisait
  // 139 426 calques et onze secondes et demie pour poser l'écran ; recousues en
  // suites, les mêmes cellules tiennent en quelques milliers de rectangles. Le
  // hub, lui, voit des zones recousues, jamais la maille.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const layer of cellsRef.current) layer.remove();
    cellsRef.current = [];

    for (const cell of cells ?? []) {
      const rectangle = L.rectangle(toBounds(map, cellRect(cell.index, cell.length)), {
        className: `gw2rp-cell gw2rp-cell--${cell.tone}`,
        fillOpacity: cell.fill,
        interactive: false,
        stroke: false,
      });
      rectangle.addTo(map);
      cellsRef.current.push(rectangle);
    }
  }, [cells]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const marker of markersRef.current.values()) marker.remove();
    markersRef.current.clear();

    // Un évènement se tient dans un lieu, donc son pin tombe exactement sur celui
    // du lieu : le pin du dessous devenait invisible et inatteignable, et la
    // carte annonçait dix pins pour six visibles. On étale la grappe en une
    // rangée **centrée sur le point** — le point désigné reste le vrai, et
    // chaque pin garde un centre à soi où cliquer.
    const grappes = new Map<string, MapPin[]>();
    for (const pin of pins) {
      const cle = `${pin.x}|${pin.y}`;
      const grappe = grappes.get(cle);
      if (grappe) grappe.push(pin);
      else grappes.set(cle, [pin]);
    }
    const rang = new Map<string, { i: number; sur: number }>();
    for (const grappe of grappes.values()) {
      grappe.forEach((pin, i) => rang.set(pin.id, { i, sur: grappe.length }));
    }

    for (const pin of pins) {
      const state: MarkerState = pin.id === selectedId ? "selectionne" : pin.state;
      const size = state === "selectionne" ? 44 : 34;
      const place = rang.get(pin.id) ?? { i: 0, sur: 1 };
      const ecart = (place.i - (place.sur - 1) / 2) * ESPACEMENT_GRAPPE;

      const marker = L.marker(map.unproject([pin.x, pin.y], COORDINATE_ZOOM), {
        icon: L.divIcon({
          html: markerHtml(pin.type, state),
          className: "gw2rp-pin",
          iconSize: [size, size],
          // Décaler l'ancre décale l'icône en sens inverse : la rangée s'étale
          // autour du point, jamais d'un seul côté.
          iconAnchor: [size / 2 - ecart, size / 2],
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
