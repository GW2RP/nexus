import type { Metadata } from "next";

import { WeatherBadge } from "@/components/content/weather-badge";
import { WeatherForm } from "@/components/forms/weather-form";
import { WeatherGlyph } from "@/components/type-glyph";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REGION_LABELS, WEATHER_LABELS } from "@/lib/domain";
import { formatLongDate } from "@/lib/dates";
import { isStoryteller } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { getCurrentWeather, getUpcomingWeather } from "@/server/queries/weather";

export const metadata: Metadata = buildMetadata({
  title: "Météo des régions",
  description:
    "La météo tyrienne en cours et la frise des saisons à venir : dégagé, nuages, pluie fine, orage, brume ou neige, région par région.",
  path: "/meteo",
  keywords: ["météo tyrienne", "saisons Guild Wars 2 RP"],
});

export default async function WeatherPage() {
  const user = await getCurrentUser();
  const [current, upcoming] = await Promise.all([getCurrentWeather(), getUpcomingWeather(12)]);

  return (
    <div className="mx-auto max-w-[1080px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader title="Météo des régions" />

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-14">
        <div className="min-w-0 flex-1">
          <section className="mb-10" aria-labelledby="en-cours">
            <SectionHeading id="en-cours" title="En ce moment" />
            {current.length > 0 ? (
              <ul className="flex flex-wrap gap-4">
                {current.map((entry) => (
                  <li key={entry.id}>
                    <WeatherBadge weather={entry} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Le ciel est vide"
              />
            )}
          </section>

          <section aria-labelledby="frise">
            <SectionHeading id="frise" title="La frise de saison" />
            {upcoming.length > 0 ? (
              <ul className="flex flex-col">
                {upcoming.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-4 border-b border-hairline py-4 last:border-b-0"
                  >
                    <WeatherGlyph
                      condition={entry.condition}
                      size={20}
                      className="mt-1 text-rain"
                    />
                    <div className="min-w-0">
                      <p className="font-display text-[18px] font-semibold tracking-[1px]">
                        {WEATHER_LABELS[entry.condition]} sur {REGION_LABELS[entry.region]}
                      </p>
                      <p className="mt-1 text-[16px] text-ink-muted">
                        {formatLongDate(new Date(entry.startsAt))} →{" "}
                        {formatLongDate(new Date(entry.endsAt))} ·{" "}
                        {formatTyrianDate(new Date(entry.startsAt))} · intensité{" "}
                        {entry.intensity} %
                      </p>
                      {entry.note ? (
                        <p className="mt-1 text-[17px] text-ink-body">{entry.note}</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Rien d'annoncé" />
            )}
          </section>
        </div>

        <aside className="lg:w-[360px] lg:shrink-0">
          <Card accent className="p-6">
            <h2 className="mb-2 font-display text-[18px] font-semibold tracking-[1px]">
              POSER UNE MÉTÉO
            </h2>
            <p className="mb-4 text-[17px] leading-[1.5] text-ink-body">
              L'écriture est réservée aux conteurs et à l'administration. Une entrée couvre une
              région et une période.
            </p>
            {isStoryteller(user) ? (
              <WeatherForm />
            ) : (
              <p className="text-[17px] leading-[1.5] text-ink-muted">
                Votre rôle ne permet pas de poser la météo. Demandez-le à l'équipe si vous
                menez des scènes qui en ont besoin.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
