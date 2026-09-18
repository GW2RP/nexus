import { WeatherGlyph } from "@/components/type-glyph";
import { REGION_LABELS, WEATHER_LABELS } from "@/lib/domain";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { cn } from "@/lib/utils";
import type { WeatherEntry } from "@/server/types";

/** La puce de météo : condition sur une ligne, date tyrienne en dessous. */
export function WeatherBadge({
  weather,
  className,
}: {
  weather: WeatherEntry;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-start gap-3 border-2 border-rule bg-surface px-3 py-2",
        className,
      )}
    >
      <WeatherGlyph condition={weather.condition} size={20} className="mt-0.5 text-rain" />
      <span className="leading-[1.45]">
        <span className="block text-[16px] text-ink">
          {WEATHER_LABELS[weather.condition]} sur {REGION_LABELS[weather.region]}
        </span>
        <span className="block text-[15px] text-ink-muted">
          {formatTyrianDate(new Date(weather.startsAt))}
          {weather.note ? ` · ${weather.note}` : ""}
        </span>
      </span>
    </span>
  );
}
