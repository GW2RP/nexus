"use client";

import { useMemo, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { Button } from "@/components/ui/button";
import type { EventType, PlaceType } from "@/lib/domain";
import { clampX, clampY } from "@/lib/map";

/** La moitié du cadre d'ouverture quand un point est déjà posé, en pixels de
 *  continent : de quoi reconnaître la côte autour du point sans partir au
 *  zoom maximal. À la vue par défaut, un point posé ailleurs qu'au cœur de la
 *  Tyrie tomberait hors du cadre — on ne saurait ni qu'il existe ni où. */
const DEMI_CADRE = 6_000;

/** Choisir un emplacement en pointant la carte, plutôt qu'en tapant deux
 *  coordonnées. Les valeurs partent quand même dans le formulaire, par deux
 *  champs cachés. */
export function MapPicker({
  kind = "lieu",
  type,
  name,
  initial,
  error,
}: {
  /** Ce qu'on pose : le pin reprend le glyphe du lieu ou de l'évènement. */
  kind?: "lieu" | "evenement";
  type: PlaceType | EventType;
  name: string;
  initial?: { x: number; y: number } | null;
  error?: string;
}) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(initial ?? null);

  // Le cadrage d'ouverture ne se lit qu'au montage : le figer sur le point
  // d'origine évite que la carte saute à chaque clic.
  const cadre = useMemo(
    () =>
      initial
        ? {
            left: clampX(initial.x - DEMI_CADRE),
            top: clampY(initial.y - DEMI_CADRE),
            right: clampX(initial.x + DEMI_CADRE),
            bottom: clampY(initial.y + DEMI_CADRE),
          }
        : null,
    // Le point de départ vient du serveur et ne change pas en cours de saisie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pins: MapPin[] = point
    ? [
        {
          id: "choisi",
          kind,
          type,
          name: name || (kind === "lieu" ? "Ce lieu" : "Cet évènement"),
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
          <MapCanvas
            pins={pins}
            onPick={setPoint}
            initialFrame={cadre}
            className="size-full bg-map-land"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-[16px] text-ink-muted">
          {point
            ? `Point posé en ${point.x} · ${point.y}.`
            : kind === "lieu"
              ? "Cliquez sur la carte pour poser le lieu."
              : "Cliquez sur la carte pour poser la scène."}
        </p>
        {point ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setPoint(null)}>
            RETIRER LE POINT
          </Button>
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
