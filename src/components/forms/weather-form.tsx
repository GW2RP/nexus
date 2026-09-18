"use client";

import { useActionState } from "react";

import { Field, Input, Select, Slider, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  REGIONS,
  REGION_LABELS,
  WEATHER_CONDITIONS,
  WEATHER_LABELS,
} from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { setWeatherAction } from "@/server/actions/weather";

/** Poser la météo d'une région. Le panneau dit à l'écran que l'écriture est
 *  réservée aux conteurs et à l'administration. */
export function WeatherForm() {
  const [state, formAction] = useActionState(setWeatherAction, idleState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Région" htmlFor="weather-region" required error={errors.region}>
          <Select id="weather-region" name="region" required defaultValue="kryte">
            {REGIONS.map((region) => (
              <option key={region} value={region}>
                {REGION_LABELS[region]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Condition" htmlFor="weather-condition" required error={errors.condition}>
          <Select id="weather-condition" name="condition" required defaultValue="pluie-fine">
            {WEATHER_CONDITIONS.map((condition) => (
              <option key={condition} value={condition}>
                {WEATHER_LABELS[condition]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Début" htmlFor="weather-start" required error={errors.startsAt}>
          <Input id="weather-start" name="startsAt" type="datetime-local" required />
        </Field>

        <Field label="Fin" htmlFor="weather-end" required error={errors.endsAt}>
          <Input id="weather-end" name="endsAt" type="datetime-local" required />
        </Field>
      </div>

      <Field
        label="Intensité"
        htmlFor="weather-intensity"
        hint="De 0 à 100 : elle règle l'opacité de la hachure sur la carte."
        error={errors.intensity}
      >
        <Slider id="weather-intensity" name="intensity" min={0} max={100} defaultValue={50} />
      </Field>

      <Field
        label="Note"
        htmlFor="weather-note"
        hint="Une ligne affichée sous la condition : « crépuscule », « vent de mer »."
        error={errors.note}
      >
        <Textarea id="weather-note" name="note" rows={2} maxLength={240} />
      </Field>

      <FormMessage state={state} />

      <SubmitButton pendingLabel="ENREGISTREMENT…">POSER CETTE MÉTÉO</SubmitButton>
    </form>
  );
}
