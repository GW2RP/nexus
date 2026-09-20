"use client";

import { useActionState, useState } from "react";

import { PauseIcon, RepeatIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-state";
import {
  extendSeriesAction,
  toggleOccurrenceAction,
  toggleSeriesPauseAction,
} from "@/server/actions/events";
import type { EventSeriesDetail } from "@/server/types";

/** Le bandeau d'une série : ce qu'elle promet, et l'interrupteur qui l'arrête.
 *
 *  Une pause ne supprime rien : les séances à venir quittent l'agenda et y
 *  reviennent à la reprise, avec leurs inscrits. C'est la différence avec
 *  « retirer une séance », et elle se dit à l'écran. */
export function SeriesBanner({
  series,
  nextLabel,
}: {
  series: EventSeriesDetail;
  /** La prochaine séance tenue, quand il en reste une. */
  nextLabel: string | null;
}) {
  const [state, formAction] = useActionState(toggleSeriesPauseAction, idleState);

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-col gap-5 border-2 p-6 sm:flex-row sm:items-center ${
          series.paused ? "border-rule bg-chip" : "border-gold bg-surface"
        }`}
      >
        <div className="flex grow items-start gap-[14px]">
          {series.paused ? (
            <PauseIcon size={22} className="mt-1 text-ink-muted" />
          ) : (
            <RepeatIcon size={22} className="mt-1 text-gold-ink" />
          )}
          <div className="flex flex-col gap-1">
            <p className="panel-title">{series.paused ? "Série en pause" : series.rule}</p>
            <p className="body-compact text-ink-body">
              {series.paused
                ? "Les séances à venir ont quitté l'agenda. Elles y reviennent à la reprise, aux mêmes dates, avec leurs inscrits."
                : (nextLabel ?? "Plus aucune séance à venir.")}
            </p>
          </div>
        </div>

        <form action={formAction} className="shrink-0">
          <input type="hidden" name="seriesId" value={series.id} />
          <SubmitButton size="lead" pendingLabel="EN COURS…">
            {series.paused ? "REPRENDRE LA SÉRIE" : "METTRE LA SÉRIE EN PAUSE"}
          </SubmitButton>
        </form>
      </div>

      <FormMessage state={state} />
    </div>
  );
}

/** Prolonger une série sans fin. Rien ne s'écrit dans le dos de l'organisateur
 *  pendant qu'il lit sa page : c'est lui qui demande le lot suivant. */
export function ExtendSeries({ seriesId }: { seriesId: string }) {
  const [state, formAction] = useActionState(extendSeriesAction, idleState);

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction}>
        <input type="hidden" name="seriesId" value={seriesId} />
        <SubmitButton variant="outline" pendingLabel="ÉCRITURE…">
          PROLONGER LA SÉRIE
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

/** Retirer une séance, ou la rétablir.
 *
 *  Retirer n'est pas supprimer : la séance garde ses inscrits, et se rétablit.
 *  C'est pour cela qu'un simple lien suffit au retour, là où le retrait passe
 *  par une modale — il touche des gens qui avaient noté la date. */
export function OccurrenceAction({
  eventId,
  cancelled,
  title,
  whenLabel,
  registeredCount,
  hasFollowing,
}: {
  eventId: string;
  cancelled: boolean;
  title: string;
  whenLabel: string;
  registeredCount: number;
  /** Il reste des séances après celle-ci : on peut les retirer d'un coup. */
  hasFollowing: boolean;
}) {
  const [state, formAction] = useActionState(toggleOccurrenceAction, idleState);
  const [open, setOpen] = useState(false);

  if (cancelled) {
    return (
      <form action={formAction} className="flex flex-col items-end gap-1">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="retablir" value="1" />
        <SubmitButton variant="link" size="inline" pendingLabel="Rétablissement…">
          Rétablir cette séance
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-end gap-1">
        <AlertDialogTrigger asChild>
          <Button variant="link" size="inline">
            Retirer cette séance
          </Button>
        </AlertDialogTrigger>
        <FormMessage state={state} />
      </div>

      <AlertDialogContent>
        <AlertDialogTitle>Retirer la séance du {whenLabel} ?</AlertDialogTitle>
        <AlertDialogDescription className="mt-3">
          {registeredCount > 0
            ? `Cette séance quitte l'agenda et la carte. Les ${registeredCount} personnes inscrites n'y sont plus attendues, et ne sont pas prévenues. Elles y seront de nouveau si vous rétablissez la séance.`
            : "Cette séance quitte l'agenda et la carte. Les autres séances de la série ne bougent pas, et vous pourrez la rétablir."}
        </AlertDialogDescription>

        <div className="mt-4 border border-chip-edge bg-surface-inset p-4">
          <p className="font-display text-[18px] font-semibold">{title}</p>
          <p className="mt-1 meta text-ink-muted">{whenLabel}</p>
        </div>

        <form action={formAction} className="mt-6 flex flex-col gap-5">
          <input type="hidden" name="eventId" value={eventId} />

          {hasFollowing ? (
            <label className="flex min-h-tap cursor-pointer items-center gap-3">
              <Checkbox name="suivantes" />
              <span className="text-[17px] text-ink">Retirer aussi les séances suivantes</span>
            </label>
          ) : null}

          <div className="flex justify-end gap-3">
            <AlertDialogCancel asChild>
              <Button type="button" variant="outline" autoFocus>
                ANNULER
              </Button>
            </AlertDialogCancel>
            <SubmitButton pendingLabel="RETRAIT…">RETIRER LA SÉANCE</SubmitButton>
          </div>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
