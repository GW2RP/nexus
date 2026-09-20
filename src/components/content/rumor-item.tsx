"use client";

import Link from "next/link";
import { useActionState } from "react";

import { ReportDialog } from "@/components/report-dialog";
import { cn } from "@/lib/utils";
import { idleState } from "@/lib/action-state";
import { echoRumorAction } from "@/server/actions/rumors";
import { formatRelativePast } from "@/lib/dates";
import type { RumorSummary } from "@/server/types";

/** Une rumeur au tableau. La reprendre la fait monter dans les plus reprises ;
 *  on ne reprend qu'une fois et on peut se rétracter.
 *
 *  Elle porte une ancre : une rumeur épinglée sur la carte n'a pas de fiche à
 *  elle, donc son pin renvoie ici, sur la ligne exacte. `scroll-mt` laisse la
 *  place de l'en-tête collant, sans quoi elle arriverait dessous. */
export function RumorItem({
  rumor,
  canEcho,
  canReport,
  compact = false,
}: {
  rumor: RumorSummary;
  canEcho: boolean;
  canReport: boolean;
  compact?: boolean;
}) {
  const [, echoAction] = useActionState(echoRumorAction, idleState);

  const attribution = [
    formatRelativePast(new Date(rumor.createdAt)),
    rumor.place?.name ?? rumor.heardAtLabel,
  ].filter(Boolean);

  return (
    <li
      id={`rumeur-${rumor.id}`}
      className="scroll-mt-24 border-b border-hairline py-[17px] target:bg-surface-selected last:border-b-0"
    >
      <p
        className={cn(
          "mb-2 italic leading-[1.5] text-ink",
          compact ? "text-[18px]" : "text-[19px] sm:text-[21px]",
        )}
      >
        {rumor.body}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[15px] text-ink-muted">
        <span>
          {rumor.character ? (
            <>
              Rapportée par{" "}
              <Link
                href={`/personnages/${rumor.character.slug}`}
                className="text-crimson-ink underline-offset-4 hover:underline"
              >
                {rumor.character.name}
              </Link>{" "}
              ·{" "}
            </>
          ) : rumor.author ? (
            <>Colportée par {rumor.author.name} · </>
          ) : null}
          {attribution.join(" · ")}
        </span>

        <span className="flex items-center gap-1">
          {canEcho ? (
            <form action={echoAction}>
              <input type="hidden" name="rumorId" value={rumor.id} />
              <button
                type="submit"
                aria-pressed={rumor.viewerHasEchoed}
                className={cn(
                  "inline-flex min-h-tap items-center border px-3 py-2 font-display text-[10px] font-medium tracking-[1.4px]",
                  rumor.viewerHasEchoed
                    ? "border-gold-ink bg-gold-ink text-on-crimson"
                    : "border-chip-edge bg-transparent text-gold-ink hover:bg-surface-selected",
                )}
              >
                {rumor.viewerHasEchoed ? "VOUS AVEZ REPRIS" : "J'AI ENTENDU ÇA AUSSI"} ·{" "}
                {rumor.echoCount}
              </button>
            </form>
          ) : (
            <span className="font-display text-[10px] font-medium tracking-[1.4px] text-ink-muted">
              REPRISE {rumor.echoCount} FOIS
            </span>
          )}

          {canReport ? (
            <ReportDialog
              targetType="rumeur"
              targetId={rumor.id}
              label="Signaler cette rumeur"
              className="-my-3.5 -mr-3"
            />
          ) : null}
        </span>
      </div>
    </li>
  );
}
