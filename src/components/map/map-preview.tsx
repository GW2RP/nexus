import Link from "next/link";

import { PlaceGlyph, WeatherGlyph } from "@/components/type-glyph";
import { REGION_LABELS, WEATHER_LABELS } from "@/lib/domain";
import { CONTINENT_SIZE } from "@/lib/map";
import type { PlaceSummary, WeatherEntry } from "@/server/types";

/** L'aperçu de la carte sur l'accueil : un cadre, la hachure, et les lieux
 *  déjà posés. Ce n'est pas la carte — c'est l'invitation à l'ouvrir. */
export function MapPreview({
  places,
  weather,
}: {
  places: PlaceSummary[];
  weather: WeatherEntry[];
}) {
  const pinned = places.filter((place) => place.coordinates).slice(0, 12);

  return (
    <div className="framed">
      <div className="hatch relative aspect-[706/302] w-full overflow-hidden border border-rule">
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center font-display text-[12px] uppercase tracking-[2px] text-ink-subtle">
          [ TUILES OFFICIELLES DU JEU ]
        </span>

        {weather[0] ? (
          <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-2 border border-rule bg-surface px-3 py-2 text-[15px] text-ink-body">
            <WeatherGlyph condition={weather[0].condition} size={15} />
            {WEATHER_LABELS[weather[0].condition]} sur {REGION_LABELS[weather[0].region]}
          </span>
        ) : null}

        {pinned.map((place) => (
          <Link
            key={place.id}
            href={`/carte?lieu=${place.slug}`}
            aria-label={`${place.name} sur la carte`}
            className="absolute inline-flex size-[30px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-gold-eyebrow bg-surface text-gold-ink"
            style={{
              left: `${((place.coordinates!.x / CONTINENT_SIZE) * 100).toFixed(2)}%`,
              top: `${((place.coordinates!.y / CONTINENT_SIZE) * 100).toFixed(2)}%`,
            }}
          >
            <PlaceGlyph type={place.type} size={15} />
          </Link>
        ))}
      </div>
    </div>
  );
}
