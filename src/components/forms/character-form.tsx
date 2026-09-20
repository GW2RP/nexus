"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ImageField } from "@/components/forms/image-field";
import { RichTextField } from "@/components/forms/rich-text-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  GENDERS,
  RACES,
  RACE_LABELS,
  REGIONS,
  REGION_LABELS,
} from "@/lib/domain";
import { idleState } from "@/lib/action-state";
import { createCharacterAction, updateCharacterAction } from "@/server/actions/characters";
import type { CharacterDetail } from "@/server/types";

const GENDER_LABELS: Record<(typeof GENDERS)[number], string> = {
  feminin: "Féminin",
  masculin: "Masculin",
  neutre: "Neutre / non précisé",
};

export function CharacterForm({
  ownerId,
  character,
}: {
  /** L'auteur du contenu : les images sont rangées sous lui. */
  ownerId: string;
  character?: CharacterDetail;
}) {
  const [state, formAction] = useActionState(
    character ? updateCharacterAction : createCharacterAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {character ? <input type="hidden" name="id" value={character.id} /> : null}

      <section>
        <SectionHeading title="L'essentiel" compact />
        <div className="flex flex-col gap-4">
          <Field label="Nom du personnage" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={80}
              defaultValue={character?.name}
              placeholder="Aeliane Vhaar"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Race" htmlFor="race" required error={errors.race}>
              <Select id="race" name="race" required defaultValue={character?.race ?? "humain"}>
                {RACES.map((race) => (
                  <option key={race} value={race}>
                    {RACE_LABELS[race].neutre}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Genre" htmlFor="gender" error={errors.gender}>
              <Select id="gender" name="gender" defaultValue={character?.gender ?? "neutre"}>
                {GENDERS.map((gender) => (
                  <option key={gender} value={gender}>
                    {GENDER_LABELS[gender]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Âge"
              htmlFor="age"
              hint="En années, pour toutes les races."
              error={errors.age}
            >
              <Input
                id="age"
                name="age"
                type="number"
                min={0}
                max={900}
                defaultValue={character?.age ?? ""}
              />
            </Field>
          </div>

          <Field label="Titre ou fonction" htmlFor="title" error={errors.title}>
            <Input
              id="title"
              name="title"
              maxLength={120}
              defaultValue={character?.title ?? ""}
              placeholder="Séraphine en congé"
            />
          </Field>

          <Field
            label="Phrase d'accroche"
            htmlFor="tagline"
            hint="Ce qu'on dit d'elle ou de lui, en une ligne."
            error={errors.tagline}
          >
            <Input
              id="tagline"
              name="tagline"
              maxLength={240}
              defaultValue={character?.tagline ?? ""}
            />
          </Field>

          <Field
            label="Résumé"
            htmlFor="summary"
            hint="Trois lignes au plus : c'est ce que montre le registre."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={3}
              maxLength={600}
              defaultValue={character?.summary ?? ""}
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="État civil" compact />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Origine" htmlFor="birthplace" error={errors.birthplace}>
            <Input
              id="birthplace"
              name="birthplace"
              maxLength={120}
              defaultValue={character?.birthplace ?? ""}
              placeholder="Collines de Kessex"
            />
          </Field>

          <Field
            label="Date de naissance"
            htmlFor="birthDate"
            hint="En date tyrienne : « 3 Phénix 1305 AE »."
            error={errors.birthDate}
          >
            <Input
              id="birthDate"
              name="birthDate"
              maxLength={60}
              defaultValue={character?.birthDate ?? ""}
            />
          </Field>

          <Field label="Métier" htmlFor="occupation" error={errors.occupation}>
            <Input
              id="occupation"
              name="occupation"
              maxLength={120}
              defaultValue={character?.occupation ?? ""}
            />
          </Field>

          <Field label="Statut" htmlFor="status" error={errors.status}>
            <Input
              id="status"
              name="status"
              maxLength={120}
              defaultValue={character?.status ?? ""}
              placeholder="En congé"
            />
          </Field>

          <Field label="Région d'attache" htmlFor="homeRegion" error={errors.homeRegion}>
            <Select id="homeRegion" name="homeRegion" defaultValue={character?.region ?? ""}>
              <option value="">Sans région précise</option>
              {REGIONS.map((region) => (
                <option key={region} value={region}>
                  {REGION_LABELS[region]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Lieu d'attache" htmlFor="homePlaceLabel" error={errors.homePlaceLabel}>
            <Input
              id="homePlaceLabel"
              name="homePlaceLabel"
              maxLength={120}
              defaultValue={character?.homePlaceLabel ?? ""}
              placeholder="La Lisière de Divinité"
            />
          </Field>
        </div>
      </section>

      <section>
        <SectionHeading title="Le récit" compact />
        <div className="flex flex-col gap-4">
          <RichTextField
            label="Histoire"
            name="story"
            folder="personnages"
            ownerId={ownerId}
            rows={10}
            defaultValue={character?.story}
            error={errors.story}
          />

          <RichTextField
            label="Allure et manières"
            name="appearance"
            folder="personnages"
            ownerId={ownerId}
            rows={5}
            defaultValue={character?.appearance}
            error={errors.appearance}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Portrait" compact />
        <ImageField
          label="Portrait"
          name="portraitUrl"
          altName="portraitAlt"
          folder="personnages"
          ownerId={ownerId}
          aspect="3 / 4"
          hint="Format 3:4, 900 × 1200 px au moins. 5 Mo au plus."
          defaultUrl={character?.portraitUrl}
          defaultAlt={character?.portraitAlt}
          error={errors.portraitUrl}
          altError={errors.portraitAlt}
        />
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {character ? "ENREGISTRER LA FICHE" : "CRÉER LA FICHE"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={character ? `/personnages/${character.slug}` : "/personnages"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}
