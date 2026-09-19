import Link from "next/link";

import { GAME_TIME_ZONE, formatGameTime } from "@/lib/dates";
import { formatTyrianDate } from "@/lib/tyrian-calendar";
import { cn } from "@/lib/utils";
import type { EventSummary } from "@/server/types";

const WEEKDAYS = ["LUN", "MAR", "MER", "JEU", "VEN", "SAM", "DIM"];

const dayKeyFormatter = new Intl.DateTimeFormat("fr-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: GAME_TIME_ZONE,
});

function dayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** La vue calendrier. La date réelle vient en premier et la date tyrienne en
 *  second : c'est un choix de lisibilité, pris avec le design system. */
export function EventCalendar({
  month,
  events,
}: {
  /** Le premier jour du mois affiché. */
  month: Date;
  events: EventSummary[];
}) {
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();

  const firstDay = new Date(Date.UTC(year, monthIndex, 1));
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leadingBlanks = (firstDay.getUTCDay() + 6) % 7;

  const byDay = new Map<string, EventSummary[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.startsAt));
    const bucket = byDay.get(key);
    if (bucket) bucket.push(event);
    else byDay.set(key, [event]);
  }

  const today = dayKey(new Date());

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => new Date(Date.UTC(year, monthIndex, index + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border border-rule">
      <div className="grid grid-cols-7 border-b border-rule bg-surface">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="border-r border-hairline px-2 py-3 text-center font-display text-[11px] font-medium tracking-[1.4px] text-ink-muted last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`vide-${index}`}
                className="min-h-[92px] border-b border-r border-hairline bg-surface-inset last:border-r-0"
              />
            );
          }

          const key = dayKey(date);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = key === today;

          return (
            <div
              key={key}
              className={cn(
                "min-h-[92px] border-b border-r border-hairline p-2 last:border-r-0",
                isToday ? "bg-surface-selected" : "bg-surface",
              )}
            >
              <p className="mb-1 leading-[1.2]">
                <span className="font-display text-[17px] font-semibold text-ink">
                  {date.getUTCDate()}
                </span>
                <span className="ml-2 text-[14px] text-ink-muted">
                  {formatTyrianDate(date, { year: false })}
                  {isToday ? " · ce soir" : ""}
                </span>
              </p>
              <ul className="flex flex-col gap-1">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <Link
                      href={`/evenements/${event.slug}`}
                      className="block border-l-2 border-crimson pl-2 text-[15px] leading-[1.3] text-ink-body hover:text-ink"
                    >
                      <span className="block font-display text-[13px] text-ink-muted">
                        {formatGameTime(new Date(event.startsAt))}
                      </span>
                      {event.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
