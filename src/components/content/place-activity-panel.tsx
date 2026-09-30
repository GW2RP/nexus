"use client";

import { startTransition, useActionState, useOptimistic, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { idleState } from "@/lib/action-state";
import { formatGameTime } from "@/lib/dates";
import { MESSAGE_ACTIVITE_MAX, type PlaceActivity } from "@/lib/place-activity";
import { cn } from "@/lib/utils";
import { updatePlaceActivityAction } from "@/server/actions/places";

/**
 * Le statut du lieu, pour son équipe. L'interrupteur agit tout de suite — il
 * s'allume avant la réponse du serveur, un choix se voit au moment où on le
 * fait — et n'envoie pas de message : celui d'avant reste. Le message, lui,
 * s'enregistre à part, avec l'état du moment.
 */
export function PlaceActivityPanel({
  placeId,
  activity,
}: {
  placeId: string;
  activity: PlaceActivity | null;
}) {
  const [state, dispatch, pending] = useActionState(updatePlaceActivityAction, idleState);
  const active = activity?.active ?? false;
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);
  const [message, setMessage] = useState(activity?.message ?? "");

  function basculer() {
    const formData = new FormData();
    formData.set("id", placeId);
    formData.set("active", String(!optimisticActive));
    startTransition(() => {
      setOptimisticActive(!optimisticActive);
      dispatch(formData);
    });
  }

  return (
    <section
      aria-labelledby="statut-du-lieu"
      className="mb-8 flex flex-col gap-4 border-2 border-gold bg-surface p-5"
    >
      <h2 id="statut-du-lieu" className="eyebrow text-gold-eyebrow">
        STATUT DU LIEU
      </h2>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={optimisticActive}
          aria-labelledby="statut-du-lieu-libelle"
          onClick={basculer}
          className="flex size-tap shrink-0 items-center"
        >
          <span
            className={cn(
              "flex h-6 w-11 border p-[3px]",
              optimisticActive
                ? "justify-end border-crimson-edge bg-crimson"
                : "justify-start border-rule bg-surface-inset",
            )}
          >
            <span
              className={cn("size-4", optimisticActive ? "bg-on-crimson" : "bg-ink-subtle")}
            />
          </span>
        </button>
        <span id="statut-du-lieu-libelle" className="button-label text-ink">
          {optimisticActive ? "ACTIF" : "INACTIF"}
        </span>
        {active && activity?.since ? (
          <span className="ml-auto caption text-ink-muted">
            depuis {formatGameTime(new Date(activity.since))}
          </span>
        ) : null}
      </div>

      <form action={dispatch} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={placeId} />
        <input type="hidden" name="active" value={String(optimisticActive)} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="message-du-statut">Message</Label>
            <span className="caption text-ink-muted">
              {message.length}/{MESSAGE_ACTIVITE_MAX}
            </span>
          </div>
          <Input
            id="message-du-statut"
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={MESSAGE_ACTIVITE_MAX}
            placeholder="Soirée dansante jusqu'à 21h"
            autoComplete="off"
            aria-invalid={Boolean(state.fieldErrors?.message)}
          />
          {state.fieldErrors?.message ? (
            <p className="caption text-crimson-ink">{state.fieldErrors.message}</p>
          ) : null}
        </div>
        {active && activity?.until ? (
          <p className="caption text-ink-muted">
            Repasse en inactif à {formatGameTime(new Date(activity.until))}, message conservé.
          </p>
        ) : null}
        <Button
          type="submit"
          variant="outline"
          disabled={pending || message.trim() === (activity?.message ?? "")}
        >
          ENREGISTRER LE MESSAGE
        </Button>
      </form>

      {state.status === "error" && !state.fieldErrors ? <FormMessage state={state} /> : null}
    </section>
  );
}
