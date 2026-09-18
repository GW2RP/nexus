"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import { CONTINENT_SIZE } from "@/lib/map";
import { idleState } from "@/lib/action-state";
import { createPlaceAction, updatePlaceAction } from "@/server/actions/places";
import type { CharacterSummary, PlaceDetail } from "@/server/types";

export function PlaceForm({
  place,
  characters,
}: {
  place?: PlaceDetail;
  characters: CharacterSummary[];
}) {
  const [state, formAction] = useActionState(
    place ? updatePlaceAction : createPlaceAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {place ? <input type="hidden" name="id" value={place.id} /> : null}

      <section>
        <SectionHeading title="L'essentiel" compact />
        <div className="flex flex-col gap-4">
          <Field label="Nom du lieu" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={place?.name}
              placeholder="Taverne du Lion Noir"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" required error={errors.type}>
              <Select id="type" name="type" required defaultValue={place?.type ?? "taverne"}>
                {PLACE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {PLACE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Région" htmlFor="region" required error={errors.region}>
              <Select id="region" name="region" required defaultValue={place?.region ?? "kryte"}>
                {REGIONS.map((region) => (
                  <option key={region} value={region}>
                    {REGION_LABELS[region]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Quartier" htmlFor="district" error={errors.district}>
              <Input
                id="district"
                name="district"
                maxLength={120}
                defaultValue={place?.district ?? ""}
                placeholder="Quartier du Port, La Lisière de Divinité"
              />
            </Field>

            <Field label="Accès" htmlFor="access" error={errors.access}>
              <Input
                id="access"
                name="access"
                maxLength={120}
                defaultValue={place?.access ?? "Ouvert à tous"}
              />
            </Field>
          </div>

          <Field
            label="Résumé"
            htmlFor="summary"
            hint="Ce que montre le registre : trois lignes au plus."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={400}
              defaultValue={place?.summary ?? ""}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            hint="Une ligne vide sépare deux paragraphes."
            error={errors.description}
          >
            <Textarea
              id="description"
              name="description"
              rows={8}
              defaultValue={place?.description ?? ""}
            />
          </Field>

          {characters.length > 0 ? (
            <Field
              label="Tenu par"
              htmlFor="keeperCharacterId"
              hint="Un de vos personnages, s'il tient ce lieu."
              error={errors.keeperCharacterId}
            >
              <Select
                id="keeperCharacterId"
                name="keeperCharacterId"
                defaultValue={place?.keeper?.id ?? ""}
              >
                <option value="">Personne en particulier</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
        </div>
      </section>

      <section>
        <SectionHeading title="Emplacement sur la carte" compact />
        <p className="mb-4 text-[17px] leading-[1.5] text-ink-body">
          Les coordonnées sont des pixels de continent, entre 0 et {CONTINENT_SIZE}. Un lieu
          sans coordonnées reste au registre, mais n'apparaît pas sur la carte.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Coordonnée X" htmlFor="coordinateX" error={errors.coordinateX}>
            <Input
              id="coordinateX"
              name="coordinateX"
              type="number"
              min={0}
              max={CONTINENT_SIZE}
              defaultValue={place?.coordinates?.x ?? ""}
            />
          </Field>
          <Field label="Coordonnée Y" htmlFor="coordinateY" error={errors.coordinateY}>
            <Input
              id="coordinateY"
              name="coordinateY"
              type="number"
              min={0}
              max={CONTINENT_SIZE}
              defaultValue={place?.coordinates?.y ?? ""}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="Bannière" compact />
        <div className="flex flex-col gap-4">
          <Field
            label="Adresse de la bannière"
            htmlFor="bannerUrl"
            hint="Une image en 16:5, 1600 × 500 px au moins."
            error={errors.bannerUrl}
          >
            <Input
              id="bannerUrl"
              name="bannerUrl"
              type="url"
              defaultValue={place?.bannerUrl ?? ""}
              placeholder="https://…"
            />
          </Field>

          <Field
            label="Alternative textuelle"
            htmlFor="bannerAlt"
            hint="Exigée dès qu'une bannière est posée."
            error={errors.bannerAlt}
          >
            <Input
              id="bannerAlt"
              name="bannerAlt"
              maxLength={240}
              defaultValue={place?.bannerAlt ?? ""}
            />
          </Field>
        </div>
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {place ? "ENREGISTRER LE LIEU" : "PROPOSER CE LIEU"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={place ? `/lieux/${place.slug}` : "/lieux"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}
