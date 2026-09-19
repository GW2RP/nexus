import Link from "next/link";

import { PinIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { PlaceTypeChip } from "@/components/ui/chip";
import { FramedMedia } from "@/components/ui/framed-media";
import { REGION_LABELS } from "@/lib/domain";
import type { PlaceSummary } from "@/server/types";

export function PlaceCard({ place }: { place: PlaceSummary }) {
  return (
    <Card className="overflow-hidden">
      <FramedMedia
        src={place.bannerUrl}
        alt={place.bannerAlt ?? `Bandeau de ${place.name}`}
        placeholder="BANDEAU DU LIEU"
        dimensions={place.bannerUrl ? undefined : "1600 × 500"}
        aspect="3 / 1"
        className="border-0 border-b border-rule p-0"
        innerClassName="border-0"
      >
        <PlaceTypeChip type={place.type} onImage className="absolute left-4 top-4" />
      </FramedMedia>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="card-title">
          <Link href={`/lieux/${place.slug}`} className="hover:underline">
            {place.name}
          </Link>
        </h3>
        <p className="flex items-center gap-2 text-[16px] text-ink-muted">
          <PinIcon size={13} />
          {[place.district, REGION_LABELS[place.region]].filter(Boolean).join(", ")}
        </p>
        {place.summary ? (
          <p className="body-compact text-ink-body">{place.summary}</p>
        ) : null}
        {place.upcomingEventCount > 0 ? (
          <p className="mt-auto pt-2 text-[16px] text-crimson-ink">
            {place.upcomingEventCount} évènement{place.upcomingEventCount > 1 ? "s" : ""} à venir
          </p>
        ) : null}
      </div>
    </Card>
  );
}
