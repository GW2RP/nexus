import type { Metadata } from "next";

import { WeatherGlyph } from "@/components/type-glyph";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGION_LABELS, WEATHER_LABELS } from "@/lib/domain";
import { formatLongDate } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import {
  STEP_SLICE_EYEBROWS,
  civilDayOfStep,
  formatStepHour,
  sliceOf,
} from "@/lib/weather/schedule";
import { getCurrentWeather, getUpcomingWeather } from "@/server/queries/weather";
import type { WeatherEntry } from "@/server/types";

export const metadata: Metadata = buildMetadata({
  title: "Météo des régions",
  description:
    "La météo tyrienne en cours et les tranches à venir : dégagé, nuages, pluie fine, orage, brume ou neige, région par région.",
  path: "/meteo",
  keywords: ["météo tyrienne", "saisons Guild Wars 2 RP"],
});

// La page lit le dernier pas de simulation : elle se rend à la requête.
export const dynamic = "force-dynamic";

function Grandeur({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-hairline pt-2">
      <dt className="font-display text-[11px] font-medium tracking-[1.4px] text-gold-ink">
        {label}
      </dt>
      <dd className="mt-1 text-[18px] text-ink">{value}</dd>
    </div>
  );
}

function Bulletin({ entry }: { entry: WeatherEntry }) {
  return (
    <article className="border-2 border-rule bg-surface p-5">
      <header className="flex items-start gap-3">
        <WeatherGlyph condition={entry.condition} size={24} className="mt-1 text-rain" />
        <div className="min-w-0">
          <h3 className="font-display text-[20px] font-semibold tracking-[1px]">
            {REGION_LABELS[entry.region]}
          </h3>
          <p className="mt-1 text-[17px] text-ink-body">{WEATHER_LABELS[entry.condition]}</p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <Grandeur label="TEMPÉRATURE" value={`${entry.temperature} °C`} />
        <Grandeur label="VENT" value={`${entry.vent} km/h`} />
        <Grandeur label="HUMIDITÉ" value={`${entry.humidite} %`} />
        <Grandeur label="PRESSION" value={`${entry.pression} hPa`} />
        <Grandeur label="PRÉCIPITATIONS" value={`${entry.precipitation} %`} />
        <Grandeur label="VISIBILITÉ" value={`${entry.visibilite} %`} />
      </dl>
    </article>
  );
}

export default async function WeatherPage() {
  const [current, upcoming] = await Promise.all([getCurrentWeather(), getUpcomingWeather(12)]);

  // Les tranches à venir, regroupées : le moteur est déterministe, donc ce qui
  // s'affiche ici est exactement ce que la tâche planifiée écrira.
  const tranches = new Map<string, WeatherEntry[]>();
  for (const entry of upcoming) {
    const list = tranches.get(entry.startsAt);
    if (list) list.push(entry);
    else tranches.set(entry.startsAt, [entry]);
  }

  const courant = current[0] ?? null;

  return (
    <div className="mx-auto max-w-[1080px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader
        eyebrow={
          courant
            ? `${STEP_SLICE_EYEBROWS[sliceOf(courant.stepIndex)]} · ${formatStepHour(courant.stepIndex)} · ${formatLongDate(new Date(courant.startsAt))} · ${formatTyrianDate(civilDayOfStep(courant.stepIndex))}`
            : undefined
        }
        title="Météo des régions"
      />

      <section className="mb-12" aria-labelledby="en-cours">
        <SectionHeading id="en-cours" title="En ce moment" />
        {current.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {current.map((entry) => (
              <Bulletin key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <EmptyState title="Le ciel est vide" />
        )}
      </section>

      <section aria-labelledby="a-venir">
        <SectionHeading id="a-venir" title="Les tranches à venir" />
        {tranches.size > 0 ? (
          <ul className="flex flex-col">
            {[...tranches].map(([startsAt, entries]) => {
              const debut = new Date(startsAt);
              const pas = entries[0].stepIndex;
              return (
                <li key={startsAt} className="border-b border-hairline py-4 last:border-b-0">
                  <p className="font-display text-[11px] font-medium tracking-[1.4px] text-gold-ink">
                    {STEP_SLICE_EYEBROWS[sliceOf(pas)]} · {formatStepHour(pas)} ·{" "}
                    {formatLongDate(debut)} · {formatTyrianDate(civilDayOfStep(pas))}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                    {entries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2">
                        <WeatherGlyph condition={entry.condition} size={18} className="text-rain" />
                        <span className="text-[17px] text-ink">
                          {REGION_LABELS[entry.region]} · {WEATHER_LABELS[entry.condition]} ·{" "}
                          {entry.temperature} °C
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="Rien à annoncer" />
        )}
      </section>
    </div>
  );
}
