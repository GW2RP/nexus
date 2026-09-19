"use client";

import { useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapShape } from "@/components/map/tyria-map";
import { Button } from "@/components/ui/button";
import { clampX, clampY } from "@/lib/map";
import type { MapTone } from "@/lib/weather/tones";

type Vertex = { x: number; y: number };

/** Dessiner une zone en cliquant ses sommets sur la carte. Comme pour le point
 *  d'un lieu, la valeur part dans le formulaire par un champ caché — un seul,
 *  en JSON, parce que le nombre de sommets n'est pas connu à l'avance. */
export function PolygonPicker({
  tone,
  initial,
  error,
}: {
  tone: MapTone;
  initial?: Vertex[] | null;
  error?: string;
}) {
  const [points, setPoints] = useState<Vertex[]>(initial ?? []);

  const shapes: MapShape[] =
    points.length > 0 ? [{ id: "trace", points, tone, showVertices: true }] : [];

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="points" value={JSON.stringify(points)} />

      <div className="framed">
        <div className="h-[420px] w-full overflow-hidden border border-rule">
          <MapCanvas
            pins={[]}
            shapes={shapes}
            onPick={(point) =>
              setPoints((previous) => [
                ...previous,
                { x: clampX(point.x), y: clampY(point.y) },
              ])
            }
            className="size-full bg-map-land"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-[16px] text-ink-muted">
          {points.length === 0
            ? "Cliquez sur la carte pour poser le premier sommet."
            : `${points.length} sommet${points.length > 1 ? "s" : ""} posé${points.length > 1 ? "s" : ""}.`}
        </p>
        {points.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPoints((previous) => previous.slice(0, -1))}
            >
              RETIRER LE DERNIER SOMMET
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPoints([])}>
              TOUT EFFACER
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="caption text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
