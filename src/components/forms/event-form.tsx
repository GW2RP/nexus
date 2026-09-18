"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/forms/image-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABELS,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import { GAME_TIME_ZONE } from "@/lib/dates";
import { idleState } from "@/lib/action-state";
import { createEventAction, updateEventAction } from "@/server/actions/events";
import type { CharacterSummary, EventDetail } from "@/server/types";

/** Les champs `datetime-local` veulent « AAAA-MM-JJTHH:MM ». */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
}

export function EventForm({
  ownerId,
  event,
  places,
  characters,
}: {
  /** L\'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  event?: EventDetail;
  places: { id: string; name: string; region: string }[];
  characters: CharacterSummary[];
}) {
  const [state, formAction] = useActionState(
    event ? updateEventAction : createEventAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {event ? <input type="hidden" name="id" value={event.id} /> : null}

      <section>
        <SectionHeading title="L'annonce" compact />
        <div className="flex flex-col gap-4">
          <Field label="Titre" htmlFor="title" required error={errors.title}>
            <Input
              id="title"
              name="title"
              required
              maxLength={140}
              defaultValue={event?.title}
              placeholder="Veillée au Lion Noir"
            />
          </Field>

          <Field label="Type" htmlFor="type" required error={errors.type}>
            <Select id="type" name="type" required defaultValue={event?.type ?? "taverne"}>
              {EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Accroche"
            htmlFor="summary"
            hint="Trois lignes au plus : c'est ce que montre l'agenda."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={300}
              defaultValue={event?.summary ?? ""}
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
              defaultValue={event?.description ?? ""}
            />
          </Field>

          <Field
            label="Ce qu'il faut savoir"
            htmlFor="practicalNotes"
            hint="Une consigne par ligne : ambiance, canal en jeu, règles de la scène."
            error={errors.practicalNotes}
          >
            <Textarea
              id="practicalNotes"
              name="practicalNotes"
              rows={5}
              defaultValue={event?.practicalNotes.join("\n") ?? ""}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="Quand et où" compact />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Début"
            htmlFor="startsAt"
            required
            hint={`Heure du serveur de jeu (${GAME_TIME_ZONE}).`}
            error={errors.startsAt}
          >
            <Input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toLocalInput(event?.startsAt)}
            />
          </Field>

          <Field label="Fin" htmlFor="endsAt" error={errors.endsAt}>
            <Input
              id="endsAt"
              name="endsAt"
              type="datetime-local"
              defaultValue={toLocalInput(event?.endsAt)}
            />
          </Field>

          <Field
            label="Lieu du registre"
            htmlFor="placeId"
            hint="La région et le point sur la carte en découlent."
            error={errors.placeId}
          >
            <Select id="placeId" name="placeId" defaultValue={event?.place?.id ?? ""}>
              <option value="">Point libre sur la carte</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Point libre"
            htmlFor="freeLocationLabel"
            hint="Si la scène ne se tient pas dans un lieu du registre."
            error={errors.freeLocationLabel}
          >
            <Input
              id="freeLocationLabel"
              name="freeLocationLabel"
              maxLength={160}
              defaultValue={event?.place ? "" : (event?.locationLabel ?? "")}
              placeholder="Champs de Gendarran, près du pont"
            />
          </Field>

          <Field label="Région" htmlFor="region" error={errors.region}>
            <Select id="region" name="region" defaultValue={event?.region ?? ""}>
              <option value="">Sans région précise</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS[region]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Places"
            htmlFor="capacity"
            hint="Laissez vide si la scène n'a pas de limite."
            error={errors.capacity}
          >
            <Input
              id="capacity"
              name="capacity"
              type="number"
              min={0}
              max={999}
              defaultValue={event?.capacity ?? ""}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="Organisation et bannière" compact />
        <div className="flex flex-col gap-4">
          {characters.length > 0 ? (
            <Field
              label="Organisé par"
              htmlFor="organiserCharacterId"
              error={errors.organiserCharacterId}
            >
              <Select
                id="organiserCharacterId"
                name="organiserCharacterId"
                defaultValue={event?.organiser?.id ?? ""}
              >
                <option value="">Sans personnage organisateur</option>
                {characters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}

          <ImageField
            label="Bannière de l'évènement"
            name="bannerUrl"
            altName="bannerAlt"
            folder="evenements"
            ownerId={ownerId}
            aspect="16 / 5"
            hint="Format 16:5, 1600 × 500 px au moins. 5 Mo au plus."
            defaultUrl={event?.bannerUrl}
            defaultAlt={event?.bannerAlt}
            error={errors.bannerUrl}
            altError={errors.bannerAlt}
          />
        </div>
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {event ? "ENREGISTRER L'ANNONCE" : "PROPOSER CET ÉVÈNEMENT"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={event ? `/evenements/${event.slug}` : "/evenements"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}
