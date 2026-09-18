import Link from "next/link";

import { EventTypeChip, StatusBadge } from "@/components/ui/chip";
import { formatGameTime, formatWeekday } from "@/lib/dates";
import { toTyrianDate } from "@/lib/tyrian-calendar";
import type { EventSummary } from "@/server/types";

/** La ligne d'agenda : colonne de date à gauche, contenu au centre,
 *  état ou action à droite, filet en dessous. */
export function EventRow({ event }: { event: EventSummary }) {
  const startsAt = new Date(event.startsAt);
  const tyrian = toTyrianDate(startsAt);
  const full =
    event.capacity !== null && event.capacity > 0 && event.registeredCount >= event.capacity;

  const facts = [
    event.locationLabel,
    `${event.registeredCount} inscrit${event.registeredCount > 1 ? "s" : ""}`,
    full ? "places limitées" : null,
  ].filter(Boolean);

  return (
    <li className="flex items-start gap-4 border-b border-hairline py-4 last:border-b-0 sm:gap-6 sm:py-5">
      <div className="flex w-[70px] shrink-0 flex-col items-start sm:w-[78px] sm:border-r sm:border-hairline sm:pr-4">
        <span className="font-display text-[26px] font-bold leading-none">{tyrian.day}</span>
        <span className="mt-1 text-[15px] leading-[1.45] text-ink-muted">{tyrian.season}</span>
        <span className="text-[15px] leading-[1.45] text-ink-muted">
          {formatGameTime(startsAt)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-display text-[19px] font-semibold leading-[1.25] sm:text-[21px]">
            <Link href={`/evenements/${event.slug}`} className="hover:underline">
              {event.title}
            </Link>
          </h3>
          <EventTypeChip type={event.type} />
        </div>
        <p className="mt-1 text-[16px] leading-[1.45] text-ink-muted">
          {formatWeekday(startsAt)} · {facts.join(" · ")}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        {event.viewerStatus === "inscrit" ? (
          <>
            <StatusBadge tone="success">INSCRIT</StatusBadge>
            <Link
              href={`/evenements/${event.slug}`}
              className="text-[15px] text-crimson-ink underline-offset-4 hover:underline"
            >
              Se désinscrire
            </Link>
          </>
        ) : event.viewerStatus === "liste-attente" ? (
          <StatusBadge tone="neutral">LISTE D'ATTENTE</StatusBadge>
        ) : full ? (
          <>
            <StatusBadge tone="neutral">COMPLET</StatusBadge>
            <Link
              href={`/evenements/${event.slug}`}
              className="text-[15px] text-crimson-ink underline-offset-4 hover:underline"
            >
              Liste d'attente
            </Link>
          </>
        ) : (
          <Link
            href={`/evenements/${event.slug}`}
            className="inline-flex min-h-tap items-center border border-gold px-4 py-3 font-display text-[11px] font-semibold uppercase tracking-[1.5px] text-gold-ink hover:bg-surface-selected"
          >
            S'INSCRIRE
          </Link>
        )}
      </div>
    </li>
  );
}
