"use client";

import { useActionState } from "react";

import { Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { REGIONS, REGION_LABELS, type Region } from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { createRumorAction } from "@/server/actions/rumors";
import type { CharacterSummary } from "@/server/types";

/** Colporter une rumeur. Elle est dite par un personnage, pas par un joueur. */
export function RumorForm({
  characters,
  places,
  defaultRegion,
}: {
  characters: CharacterSummary[];
  places: { id: string; name: string }[];
  /** La région du point cliqué sur la carte, quand la rumeur part de là. */
  defaultRegion?: Region | null;
}) {
  const [state, formAction] = useActionState(createRumorAction, idleState);
  const errors = state.fieldErrors ?? {};

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

      <FormMessage state={state} />

      <SubmitButton pendingLabel="ENVOI…">COLPORTER</SubmitButton>
    </form>
  );
}
