"use client";

import { useMemo, useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import type { MapPin } from "@/components/map/tyria-map";
import { Button } from "@/components/ui/button";
import type { PinType } from "@/components/map/map-marker-html";
import { clampX, clampY } from "@/lib/map";

/** La moitié du cadre d'ouverture quand un point est déjà posé, en pixels de
 *  continent : de quoi reconnaître la côte autour du point sans partir au
 *  zoom maximal. À la vue par défaut, un point posé ailleurs qu'au cœur de la
 *  Tyrie tomberait hors du cadre — on ne saurait ni qu'il existe ni où. */
const DEMI_CADRE = 6_000;

/** Ce que le pin annonce, faute d'un nom déjà saisi, et ce que la carte demande
 *  tant que rien n'est posé. */
const MOTS: Record<"lieu" | "evenement" | "rumeur", { sans: string; consigne: string }> = {
  lieu: { sans: "Ce lieu", consigne: "Cliquez sur la carte pour poser le lieu." },
  evenement: { sans: "Cet évènement", consigne: "Cliquez sur la carte pour poser la scène." },
  rumeur: { sans: "Cette rumeur", consigne: "Cliquez sur la carte pour poser la rumeur." },
};

/** Choisir un emplacement en pointant la carte, plutôt qu'en tapant deux
 *  coordonnées. Les valeurs partent quand même dans le formulaire, par deux
 *  champs cachés. */
export function MapPicker({
  kind = "lieu",
  type,
  name,
  initial,
  height = 420,
  error,
}: {
  /** Ce qu'on pose : le pin en reprend le glyphe. Une rumeur est son propre
   *  type et n'en attend donc pas. */
  kind?: "lieu" | "evenement" | "rumeur";
  type?: PinType;
  name: string;
  initial?: { x: number; y: number } | null;
  /** La hauteur de la carte, en pixels. Une colonne latérale ne peut pas en
   *  donner autant qu'une page de formulaire. */
  height?: number;
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
          type: type ?? "rumeur",
          name: name || MOTS[kind].sans,
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
        <div className="w-full overflow-hidden border border-rule" style={{ height }}>
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
          {point ? `Point posé en ${point.x} · ${point.y}.` : MOTS[kind].consigne}
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
