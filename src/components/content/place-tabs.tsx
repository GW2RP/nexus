"use client";

import { useState } from "react";

import { MapCanvas } from "@/components/map/map-canvas";
import { FramedMedia } from "@/components/ui/framed-media";
import { PLACE_TYPE_LABELS, REGION_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { FloorPlan, PlaceDetail } from "@/server/types";

/** L'emplacement en Tyrie et les plans du lieu sont les onglets d'une même zone :
 *  un onglet par plan, nommé comme l'auteur l'a nommé — le rez-de-chaussée,
 *  l'étage, la cave. Un lieu sans plan n'affiche que le premier. */
export function PlaceTabs({ place }: { place: PlaceDetail }) {
  const plans = place.floorPlans;
  // « tyrie », ou le rang du plan montré : deux plans peuvent porter le même nom.
  const [tab, setTab] = useState<"tyrie" | number>("tyrie");
  const plan = typeof tab === "number" ? plans[tab] : undefined;

  return (
    <div>
      {plans.length > 0 ? (
        <div className="mb-5 flex max-w-full overflow-x-auto">
          <div className="inline-flex shrink-0 border border-gold">
            <TabButton active={tab === "tyrie"} onClick={() => setTab("tyrie")}>
              EMPLACEMENT EN TYRIE
            </TabButton>
            {plans.map((candidat, rang) => (
              <TabButton key={rang} active={tab === rang} onClick={() => setTab(rang)}>
                {candidat.title.toLocaleUpperCase("fr-FR")}
              </TabButton>
            ))}
          </div>
        </div>
      ) : null}

      {plan ? (
        // Le plan change, le point éclairé ne le suit pas : `key` remet la vue à
        // neuf, sinon le troisième point d'un plan s'allumerait sur le suivant.
        <FloorPlanView key={tab} plan={plan} placeName={place.name} />
      ) : place.coordinates ? (
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
      )}
    </div>
  );
}

/** Un plan et ses points numérotés, puis leur légende dessous. Cliquer l'un
 *  éclaire l'autre, dans les deux sens.
 *
 *  L'image se rend à sa proportion d'origine plutôt qu'à un rapport imposé : un
 *  recadrage déplacerait les points, qui sont posés en pourcentage de l'image
 *  entière. Les dimensions du fichier tiennent le cadre avant qu'elle arrive. */
function FloorPlanView({ plan, placeName }: { plan: FloorPlan; placeName: string }) {
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const alt = plan.imageAlt ?? `${plan.title} de ${placeName}`;

  const points = plan.points.map((point) => (
    <button
      key={point.number}
      type="button"
      onClick={() => setActivePoint(activePoint === point.number ? null : point.number)}
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
  ));

  return (
    <>
      {plan.imageUrl ? (
        <div className="framed">
          <div className="relative w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plan.imageUrl}
              alt={alt}
              style={
                plan.width && plan.height
                  ? { aspectRatio: `${plan.width} / ${plan.height}` }
                  : undefined
              }
              className="block w-full border border-rule"
              loading="lazy"
            />
            {points}
          </div>
        </div>
      ) : (
        <FramedMedia placeholder="PLAN TÉLÉVERSÉ" dimensions="1600 × 1100" aspect="16 / 11">
          {points}
        </FramedMedia>
      )}

      {plan.points.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-3">
          {plan.points.map((point) => (
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
              <span className="body-compact text-ink-body">
                <strong className="font-display font-semibold text-ink">{point.label}</strong>
                {point.description ? ` — ${point.description}` : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
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
        "inline-flex min-h-tap shrink-0 items-center whitespace-nowrap border-r border-rule px-5 py-3 font-display text-[12px] font-semibold tracking-[1.6px] last:border-r-0",
        active ? "bg-gold-ink text-on-crimson" : "text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}
