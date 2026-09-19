import Link from "next/link";

import { PinIcon } from "@/components/icons";
import { EventTypeChip } from "@/components/ui/chip";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { formatGameTime, formatWeekday } from "@/lib/dates";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import type { EventSummary } from "@/server/types";

/** La carte d'un évènement à venir. Le titre est le lien : on ne rend pas la
 *  carte entière cliquable quand elle contient déjà une action. */
export function EventCard({ event }: { event: EventSummary }) {
  const startsAt = new Date(event.startsAt);
  const full =
    event.capacity !== null && event.capacity > 0 && event.registeredCount >= event.capacity;

  return (
    <Card className="gap-3 p-5 sm:p-6">
      <CardHeader>
        <EventTypeChip type={event.type} />
        <span className="text-right leading-[1.3]">
          <span className="block font-display text-[14px] text-ink">
            {formatTyrianDate(startsAt, { year: false })}
          </span>
          <span className="block text-[14px] text-ink-muted">
            {formatWeekday(startsAt)} {formatGameTime(startsAt)}
          </span>
        </span>
      </CardHeader>

      <h3 className="card-title">
        <Link href={`/evenements/${event.slug}`} className="hover:underline">
          {event.title}
        </Link>
      </h3>

      {event.summary ? (
        <p className="body-compact text-ink-body">{event.summary}</p>
      ) : null}

      <p className="flex items-center gap-2 text-[16px] text-ink-muted">
        <PinIcon size={13} />
        {event.locationLabel}
      </p>

      <CardFooter>
        <span className="text-[16px] text-ink-muted">
          {event.registeredCount} inscrit{event.registeredCount > 1 ? "s" : ""}
          {event.capacity ? ` / ${event.capacity}` : ""}
        </span>
        {full ? (
          <span className="font-display text-[11px] font-medium tracking-[1.5px] text-ink-muted">
            Complet
          </span>
        ) : (
          <Link
            href={`/evenements/${event.slug}`}
            className="inline-flex min-h-tap items-center border border-gold px-4 py-3 font-display text-[11px] font-semibold tracking-[1.5px] text-gold-ink hover:bg-surface-selected"
          >
            {event.viewerStatus === "inscrit" ? "VOIR MON INSCRIPTION" : "S'INSCRIRE"}
          </Link>
        )}
      </CardFooter>
    </Card>
  );
}
