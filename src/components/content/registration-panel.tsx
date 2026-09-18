"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
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
  registerToEventAction,
  unregisterFromEventAction,
} from "@/server/actions/events";
import type { CharacterSummary, EventDetail } from "@/server/types";

/** Le panneau de décision : cadre 2 px `gold`, une seule action principale. */
export function RegistrationPanel({
  event,
  characters,
  isSignedIn,
  canRegister,
}: {
  event: EventDetail;
  characters: CharacterSummary[];
  isSignedIn: boolean;
  canRegister: boolean;
}) {
  const [registerState, registerAction] = useActionState(registerToEventAction, idleState);
  const [unregisterState, unregisterAction] = useActionState(
    unregisterFromEventAction,
    idleState,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const full =
    event.capacity !== null && event.capacity > 0 && event.registeredCount >= event.capacity;

  if (!isSignedIn) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[17px] leading-[1.5] text-ink-body">
          L'inscription demande un compte. Elle est annulable jusqu'à l'heure du rendez-vous.
        </p>
        <Button asChild size="lead">
          <Link href={`/connexion?suite=/evenements/${event.slug}`}>SE CONNECTER POUR S'INSCRIRE</Link>
        </Button>
      </div>
    );
  }

  if (!canRegister) {
    return (
      <p className="text-[17px] leading-[1.5] text-ink-body">
        Votre compte est suspendu : vous ne pouvez pas vous inscrire pour l'instant.
      </p>
    );
  }

  if (event.viewerStatus) {
    return (
      <div className="flex flex-col gap-4">
        <p className="font-display text-[18px] font-semibold tracking-[1px] text-success">
          {event.viewerStatus === "inscrit" ? "VOUS ÊTES INSCRIT" : "VOUS ÊTES SUR LA LISTE D'ATTENTE"}
        </p>
        <p className="text-[17px] leading-[1.5] text-ink-body">
          {event.viewerStatus === "inscrit"
            ? "Vous pourrez annuler votre inscription jusqu'à l'heure du rendez-vous."
            : "Une place qui se libère vous revient dans l'ordre d'arrivée."}
        </p>

        <FormMessage state={unregisterState} />

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline">SE DÉSINSCRIRE</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Annuler votre inscription ?</AlertDialogTitle>
            <AlertDialogDescription className="mt-3">
              {full
                ? "L'évènement est complet : votre place repart aussitôt à la première personne de la liste d'attente. Vous devrez y repasser pour revenir."
                : "Votre nom disparaît de la liste des participants. Vous pourrez vous réinscrire tant qu'il reste des places."}
            </AlertDialogDescription>

            <div className="mt-4 border border-chip-edge bg-surface-inset p-4">
              <p className="font-display text-[18px] font-semibold">{event.title}</p>
              <p className="mt-1 text-[16px] text-ink-muted">{event.locationLabel}</p>
            </div>

            <form action={unregisterAction} className="mt-6 flex justify-end gap-3">
              <input type="hidden" name="eventId" value={event.id} />
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" autoFocus>
                  ANNULER
                </Button>
              </AlertDialogCancel>
              <SubmitButton pendingLabel="EN COURS…">CONFIRMER LA DÉSINSCRIPTION</SubmitButton>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <form action={registerAction} className="flex flex-col gap-4">
      <input type="hidden" name="eventId" value={event.id} />

      {characters.length > 0 ? (
        <Field
          label="Avec quel personnage ?"
          htmlFor="registration-character"
          hint="Le nom affiché dans la liste des participants."
        >
          <Select id="registration-character" name="characterId" defaultValue={characters[0].id}>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-[17px] leading-[1.5] text-ink-body">
          Vous n'avez pas encore de personnage au registre.{" "}
          <Link
            href="/personnages/nouveau"
            className="text-crimson-ink underline underline-offset-4"
          >
            En créer un
          </Link>{" "}
          rend votre inscription lisible pour l'organisateur.
        </p>
      )}

      <FormMessage state={registerState} />

      <SubmitButton size="lead" pendingLabel="INSCRIPTION…">
        {full ? "REJOINDRE LA LISTE D'ATTENTE" : "S'INSCRIRE"}
      </SubmitButton>

      <p className="text-[15px] leading-[1.45] text-ink-muted">
        {full
          ? "Toutes les places sont prises : vous entrez sur la liste d'attente."
          : "Vous pourrez annuler votre inscription jusqu'à l'heure du rendez-vous."}
      </p>
    </form>
  );
}
