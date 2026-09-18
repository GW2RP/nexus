"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Field, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { REGIONS, REGION_LABELS } from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { createRumorAction } from "@/server/actions/rumors";
import type { CharacterSummary } from "@/server/types";

/** Colporter une rumeur. Elle est dite par un personnage, pas par un joueur. */
export function RumorForm({
  characters,
  places,
}: {
  characters: CharacterSummary[];
  places: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(createRumorAction, idleState);
  const errors = state.fieldErrors ?? {};

  if (characters.length === 0) {
    return (
      <p className="text-[17px] leading-[1.5] text-ink-body">
        Une rumeur est dite par un personnage.{" "}
        <Link
          href="/personnages/nouveau"
          className="text-crimson-ink underline underline-offset-4"
        >
          Ouvrez d'abord une fiche au registre
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Ce que vous avez entendu dire"
        htmlFor="rumor-body"
        required
        hint="Entre guillemets si c'est une parole rapportée. Elle peut être fausse : c'est le but."
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

      <Field label="Rapportée par" htmlFor="rumor-character" required error={errors.characterId}>
        <Select id="rumor-character" name="characterId" required defaultValue={characters[0].id}>
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
          <Select id="rumor-region" name="region" defaultValue="">
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
