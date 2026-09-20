"use client";

import { useActionState, useState } from "react";

import { MapPicker } from "@/components/map/map-picker";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { createRumorAction } from "@/server/actions/rumors";
import type { CharacterSummary } from "@/server/types";

/** La carte de la colonne latérale : moins haute que celle d'une page de
 *  formulaire, qui en prend quatre cent vingt — la colonne fait trois cent
 *  quarante de large, et une carte carrée y pousserait tout le reste hors de
 *  vue. */
const HAUTEUR_CARTE = 260;

/** Colporter une rumeur. Elle est dite par un personnage, pas par un joueur. */
export function RumorForm({
  characters,
  places,
  defaultRegion,
  initialCoordinates,
}: {
  characters: CharacterSummary[];
  places: { id: string; name: string }[];
  /** La région du point cliqué sur la carte, quand la rumeur part de là. */
  defaultRegion?: Region | null;
  /** Le point cliqué sur la carte, quand la rumeur part de là. */
  initialCoordinates?: { x: number; y: number } | null;
}) {
  const [state, formAction] = useActionState(createRumorAction, idleState);
  const errors = state.fieldErrors ?? {};

  // Le point est facultatif, donc la carte est repliée : la plupart des rumeurs
  // courent la Tyrie sans endroit à elles, et une carte dépliée d'office
  // occuperait la colonne pour un champ que personne n'a demandé. Elle s'ouvre
  // d'elle-même quand la rumeur arrive de la carte, avec son point déjà posé.
  const [carteOuverte, setCarteOuverte] = useState(Boolean(initialCoordinates));

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Ce que vous avez entendu dire"
        htmlFor="rumor-body"
        required
        error={errors.body}
      >
        <Textarea
          id="rumor-body"
          name="body"
          rows={3}
          required
          maxLength={600}
          placeholder="« Des caisses sans registre débarquent au quai neuf après la cloche du soir… »"
        />
      </Field>

      <Field label="Rapportée par" htmlFor="rumor-character" error={errors.characterId}>
        <Select id="rumor-character" name="characterId" defaultValue="">
          <option value="">Sans source — en votre nom</option>
          {characters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Entendue à" htmlFor="rumor-place" error={errors.placeId}>
          <Select id="rumor-place" name="placeId" defaultValue="">
            <option value="">Sans lieu précis</option>
            {places.map((place) => (
              <option key={place.id} value={place.id}>
                {place.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Région" htmlFor="rumor-region" error={errors.region}>
          <Select id="rumor-region" name="region" defaultValue={defaultRegion ?? ""}>
            <option value="">Toute la Tyrie</option>
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {REGION_LABELS[region]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {carteOuverte ? (
        <MapPicker
          kind="rumeur"
          name=""
          initial={initialCoordinates ?? null}
          height={HAUTEUR_CARTE}
          error={errors.coordinateX ?? errors.coordinateY}
        />
      ) : (
        <Button
          type="button"
          variant="quiet"
          size="sm"
          className="self-start"
          onClick={() => setCarteOuverte(true)}
        >
          ÉPINGLER SUR LA CARTE
        </Button>
      )}

      <FormMessage state={state} />

      <SubmitButton pendingLabel="ENVOI…">COLPORTER</SubmitButton>
    </form>
  );
}
