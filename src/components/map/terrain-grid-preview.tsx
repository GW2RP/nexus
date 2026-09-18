"use client";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapCell, MapShape } from "@/components/map/tyria-map";
import type { Terrain } from "@/lib/domain";
import { TERRAIN_TONES } from "@/lib/weather/tones";
import type { TerrainZoneOutline } from "@/server/types";

/** Les zones dessinées, et par-dessus la grille cuite : chaque cellule teintée
 *  par le terrain que le moteur lui donnera. Sans ça, on dessine à l'aveugle —
 *  une zone trop petite pour couvrir le centre d'une cellule n'existe pas pour
 *  la simulation, et rien ne le dirait. */
export function TerrainGridPreview({
  zones,
  cells,
}: {
  zones: TerrainZoneOutline[];
  cells: { index: number; terrain: Terrain }[];
}) {
  const shapes: MapShape[] = zones.map((zone) => ({
    id: zone.id,
    points: zone.points,
    tone: TERRAIN_TONES[zone.terrain],
  }));

  // Toutes les cellules dessinées sont montrées, mais la mer reste un fond : sur
  // ce continent elle en couvre la quasi-totalité, et à teinte égale elle
  // effacerait justement ce qu'on vient vérifier.
  const painted: MapCell[] = cells.map((cell) => ({
    index: cell.index,
    tone: TERRAIN_TONES[cell.terrain],
    fill: cell.terrain === "mer" ? 0.1 : 0.4,
  }));

  return (
    <div className="framed">
      <div className="h-[520px] w-full overflow-hidden border border-rule">
        <MapCanvas
          pins={[]}
          shapes={shapes}
          cells={painted}
          className="size-full bg-map-land"
        />
      </div>
    </div>
  );
}
