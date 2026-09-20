"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { Button } from "@/components/ui/button";
import type { MapCellRun, MapShape } from "@/components/map/tyria-map";
import { REGION_LABELS, TERRAINS, TERRAIN_LABELS } from "@/lib/domain";
import {
  GRID_COLS,
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
  grille,
}: {
  zones: TerrainZoneOutline[];
  /** Un caractère par cellule : le rang du terrain dans `TERRAINS`. */
  grille: string;
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
  // effacerait justement ce qu'on vient vérifier. La plaine ne se dessine pas :
  // c'est le terrain de ce que personne n'a couvert.
  //
  // Les cellules partent recousues par lignes : une suite de voisines de même
  // terrain devient un seul rectangle. Ces rectangles n'ayant pas de trait, le
  // dessin est le même au pixel près — mais la mer, qui couvre presque tout le
  // continent, passe de cent mille calques à quelques centaines.
  const painted = useMemo<MapCellRun[]>(() => {
    const suites: MapCellRun[] = [];
    let debut = -1;
    let rang = -1;

    const fermer = (fin: number) => {
      if (debut < 0) return;
      const terrain = TERRAINS[rang];
      suites.push({
        index: debut,
        length: fin - debut,
        tone: TERRAIN_TONES[terrain],
        fill: terrain === "mer" ? 0.1 : 0.4,
      });
      debut = -1;
    };

    for (let index = 0; index < grille.length; index += 1) {
      const code = grille.charCodeAt(index) - 48;
      const terrain = TERRAINS[code];
      // Une suite ne franchit pas le bord de la grille : le rectangle d'une
      // ligne reviendrait sinon à l'autre bout du continent.
      const coupe = index % GRID_COLS === 0 || code !== rang;
      if (coupe) fermer(index);
      if (!terrain || terrain === "plaine") {
        rang = -1;
        continue;
      }
      if (debut < 0) debut = index;
      rang = code;
    }
    fermer(grille.length);

    return suites;
  }, [grille]);

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
        <div className="relative h-[520px] w-full overflow-hidden border border-rule">
          <MapCanvas
            pins={[]}
            shapes={shapes}
            cells={painted}
            onPick={sonder}
            className="size-full bg-map-land"
          />

          {/* La zone relevée s'ouvre depuis la carte : elle est déjà sous les
              yeux, la retrouver dans la liste plus bas est un détour. Le calque
              laisse passer les clics ; seul le bouton les prend, sans quoi il
              couvrirait un coin de carte qu'on ne pourrait plus sonder. */}
          {ping?.auPoint ? (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex justify-end p-3">
              <Button asChild variant="outline" size="sm" className="pointer-events-auto bg-surface">
                <Link href={`/admin/terrains/${ping.auPoint.id}`}>
                  MODIFIER {ping.auPoint.name.toLocaleUpperCase("fr-FR")}
                </Link>
              </Button>
            </div>
          ) : null}
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
