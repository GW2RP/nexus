"use client";

import { useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapCell, MapShape } from "@/components/map/tyria-map";
import { REGION_LABELS, TERRAIN_LABELS, type Terrain } from "@/lib/domain";
import {
  cellCenter,
  cellColumn,
  cellIndexAt,
  cellRow,
  zoneAt,
} from "@/lib/weather/grid";
import { TERRAIN_TONES } from "@/lib/weather/tones";
import type { TerrainZoneOutline } from "@/server/types";

type Point = { x: number; y: number };

type Ping = {
  point: Point;
  index: number;
  /** La zone qui couvre le point cliqué. */
  auPoint: TerrainZoneOutline | null;
  /** Celle que la simulation retient : elle juge le centre de la cellule. */
  auCentre: TerrainZoneOutline | null;
};

function nomDeZone(zone: TerrainZoneOutline | null): string {
  if (!zone) return "Aucune zone";
  const region = zone.region ? REGION_LABELS[zone.region] : "hors région";
  return `${zone.name} — ${TERRAIN_LABELS[zone.terrain]} · ${region}`;
}

function Releve({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="border-t border-hairline pt-2">
      <dt className="font-display text-[11px] font-medium tracking-[1.4px] text-gold-ink">
        {label}
      </dt>
      <dd className="mt-1 text-[17px] text-ink">{valeur}</dd>
    </div>
  );
}

/** Les zones dessinées, et par-dessus la grille cuite : chaque cellule teintée
 *  par le terrain que le moteur lui donnera. Sans ça, on dessine à l'aveugle —
 *  une zone trop petite pour couvrir le centre d'une cellule n'existe pas pour
 *  la simulation, et rien ne le dirait.
 *
 *  Cliquer la carte interroge ce même calcul en un point : `zoneAt` est celui de
 *  la cuisson, donc le relevé ne peut pas diverger de ce qui sera simulé. */
export function TerrainGridPreview({
  zones,
  cells,
}: {
  zones: TerrainZoneOutline[];
  cells: { index: number; terrain: Terrain }[];
}) {
  const [ping, setPing] = useState<Ping | null>(null);

  const shapes: MapShape[] = zones.map((zone) => ({
    id: zone.id,
    points: zone.points,
    tone: TERRAIN_TONES[zone.terrain],
    // La zone relevée se distingue le temps qu'on la regarde.
    showVertices: ping?.auPoint?.id === zone.id,
  }));

  // Toutes les cellules dessinées sont montrées, mais la mer reste un fond : sur
  // ce continent elle en couvre la quasi-totalité, et à teinte égale elle
  // effacerait justement ce qu'on vient vérifier.
  const painted: MapCell[] = cells.map((cell) => ({
    index: cell.index,
    tone: TERRAIN_TONES[cell.terrain],
    fill: cell.terrain === "mer" ? 0.1 : 0.4,
  }));

  function sonder(point: Point) {
    const index = cellIndexAt(point.x, point.y);
    const centre = cellCenter(index);
    setPing({
      point,
      index,
      auPoint: zoneAt(point.x, point.y, zones),
      auCentre: zoneAt(centre.x, centre.y, zones),
    });
  }

  const desaccord = ping !== null && ping.auPoint?.id !== ping.auCentre?.id;

  return (
    <div className="flex flex-col gap-4">
      <div className="framed">
        <div className="h-[520px] w-full overflow-hidden border border-rule">
          <MapCanvas
            pins={[]}
            shapes={shapes}
            cells={painted}
            onPick={sonder}
            className="size-full bg-map-land"
          />
        </div>
      </div>

      <div aria-live="polite">
        {ping ? (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            <Releve label="POINT" valeur={`${ping.point.x} · ${ping.point.y}`} />
            <Releve
              label="CELLULE"
              valeur={`${ping.index} — colonne ${cellColumn(ping.index)}, ligne ${cellRow(ping.index)}`}
            />
            <Releve label="AU POINT CLIQUÉ" valeur={nomDeZone(ping.auPoint)} />
            <Releve label="CE QUE LA SIMULATION RETIENT" valeur={nomDeZone(ping.auCentre)} />
          </dl>
        ) : (
          <p className="text-[16px] text-ink-muted">Cliquez la carte pour sonder un point.</p>
        )}
      </div>

      {desaccord ? (
        <p role="status" className="body-compact text-crimson-ink">
          Le point et le centre de sa cellule ne tombent pas dans la même zone : la
          simulation juge le centre.
        </p>
      ) : null}
    </div>
  );
}
