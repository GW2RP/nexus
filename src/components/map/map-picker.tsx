"use client";

import { useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { Button } from "@/components/ui/button";
import type { PlaceType } from "@/lib/domain";

/** Choisir l'emplacement d'un lieu en pointant la carte, plutôt qu'en tapant
 *  deux coordonnées. Les valeurs partent quand même dans le formulaire, par
 *  deux champs cachés. */
export function MapPicker({
  type,
  name,
  initial,
  error,
}: {
  type: PlaceType;
  name: string;
  initial?: { x: number; y: number } | null;
  error?: string;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(initial ?? null);

  const pins: MapPin[] = point
    ? [
        {
          id: "choisi",
          kind: "lieu",
          type,
          name: name || "Ce lieu",
          meta: "Emplacement choisi",
          href: "#",
          x: point.x,
          y: point.y,
          state: "selectionne",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name="coordinateX" value={point?.x ?? ""} />
      <input type="hidden" name="coordinateY" value={point?.y ?? ""} />

      <div className="framed">
        <div className="h-[420px] w-full overflow-hidden border border-rule">
          <MapCanvas pins={pins} onPick={setPoint} className="size-full bg-map-land" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-[16px] text-ink-muted">
          {point
            ? `Point posé en ${point.x} · ${point.y}.`
            : "Cliquez sur la carte pour poser le lieu."}
        </p>
        {point ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setPoint(null)}>
            RETIRER LE POINT
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-[15px] leading-[1.45] text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
