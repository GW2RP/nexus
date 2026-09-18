"use client";

import { useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { FramedMedia } from "@/components/ui/framed-media";
import { PLACE_TYPE_LABELS, REGION_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { PlaceDetail } from "@/server/types";

/** L'emplacement en Tyrie et le plan intérieur sont deux onglets de la même zone.
 *  Un lieu sans plan n'affiche que le premier. */
export function PlaceTabs({ place }: { place: PlaceDetail }) {
  const hasPlan = Boolean(place.floorPlan && place.floorPlan.points.length > 0);
  const [tab, setTab] = useState<"tyrie" | "plan">("tyrie");
  const [activePoint, setActivePoint] = useState<number | null>(null);

  return (
    <div>
      {hasPlan ? (
        <div className="mb-5 inline-flex border border-gold">
          <TabButton active={tab === "tyrie"} onClick={() => setTab("tyrie")}>
            EMPLACEMENT EN TYRIE
          </TabButton>
          <TabButton active={tab === "plan"} onClick={() => setTab("plan")}>
            PLAN INTÉRIEUR
          </TabButton>
        </div>
      ) : null}

      {tab === "tyrie" || !hasPlan ? (
        place.coordinates ? (
          <div className="framed">
            <div className="h-[420px] w-full overflow-hidden border border-rule">
              <MapCanvas
                pins={[
                  {
                    id: place.id,
                    kind: "lieu",
                    type: place.type,
                    name: place.name,
                    meta: [PLACE_TYPE_LABELS[place.type], REGION_LABELS[place.region]].join(" · "),
                    href: `/lieux/${place.slug}`,
                    x: place.coordinates.x,
                    y: place.coordinates.y,
                    state: "selectionne",
                  },
                ]}
                interactive={false}
                className="size-full bg-map-land"
              />
            </div>
          </div>
        ) : (
          <FramedMedia placeholder="LIEU SANS POINT SUR LA CARTE" aspect="16 / 9" />
        )
      ) : (
        <>
          <FramedMedia
            src={place.floorPlan?.imageUrl}
            alt={place.floorPlan?.imageAlt ?? `Plan intérieur de ${place.name}`}
            placeholder="PLAN TÉLÉVERSÉ"
            dimensions={place.floorPlan?.imageUrl ? undefined : "1600 × 1100"}
            aspect="16 / 11"
          >
            {place.floorPlan?.points.map((point) => (
              <button
                key={point.number}
                type="button"
                onClick={() =>
                  setActivePoint(activePoint === point.number ? null : point.number)
                }
                aria-pressed={activePoint === point.number}
                aria-label={`Point ${point.number} : ${point.label}`}
                className={cn(
                  "absolute inline-flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-display text-[15px] font-bold",
                  activePoint === point.number
                    ? "border-crimson-edge bg-crimson text-on-crimson"
                    : "border-gold bg-surface text-gold-ink",
                )}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
              >
                {point.number}
              </button>
            ))}
          </FramedMedia>

          <ul className="mt-5 flex flex-col gap-3">
            {place.floorPlan?.points.map((point) => (
              <li key={point.number} className="flex items-start gap-3">
                <span
                  className={cn(
                    "inline-flex size-6 shrink-0 items-center justify-center rounded-full border font-display text-[13px] font-bold",
                    activePoint === point.number
                      ? "border-crimson-edge bg-crimson text-on-crimson"
                      : "border-gold bg-surface text-gold-ink",
                  )}
                >
                  {point.number}
                </span>
                <span className="text-[17px] leading-[1.5] text-ink-body">
                  <strong className="font-display font-semibold text-ink">{point.label}</strong>
                  {point.description ? ` — ${point.description}` : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-tap items-center border-r border-rule px-5 py-3 font-display text-[12px] font-semibold uppercase tracking-[1.6px] last:border-r-0",
        active ? "bg-gold-ink text-on-crimson" : "text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}
