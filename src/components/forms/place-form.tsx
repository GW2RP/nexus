"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/forms/image-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  type PlaceType,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import { MapPicker } from "@/components/map/map-picker";
import { idleState } from "@/lib/action-state";
import { createPlaceAction, updatePlaceAction } from "@/server/actions/places";
import type { CharacterSummary, PlaceDetail } from "@/server/types";

export function PlaceForm({
  ownerId,
  place,
  characters,
}: {
  /** L\'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  place?: PlaceDetail;
  characters: CharacterSummary[];
}) {
  const [state, formAction] = useActionState(
    place ? updatePlaceAction : createPlaceAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  // Le pin de la carte reprend le glyphe du type choisi et le nom saisi.
  const [type, setType] = useState<PlaceType>(place?.type ?? "taverne");
  const [name, setName] = useState(place?.name ?? "");

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
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Taverne du Lion Noir"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" required error={errors.type}>
              <Select
                id="type"
                name="type"
                required
                value={type}
                onChange={(event) => setType(event.target.value as PlaceType)}
              >
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
        <MapPicker
          type={type}
          name={name}
          initial={place?.coordinates ?? null}
          error={errors.coordinateX ?? errors.coordinateY}
        />
      </section>

      <section>
        <SectionHeading title="Bannière" compact />
        <ImageField
          label="Bannière du lieu"
          name="bannerUrl"
          altName="bannerAlt"
          folder="lieux"
          ownerId={ownerId}
          aspect="16 / 5"
          hint="Format 16:5, 1600 × 500 px au moins. 5 Mo au plus."
          defaultUrl={place?.bannerUrl}
          defaultAlt={place?.bannerAlt}
          error={errors.bannerUrl}
          altError={errors.bannerAlt}
        />
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
