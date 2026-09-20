"use client";

import { useActionState, useState } from "react";

import { AccountPicker } from "@/components/forms/account-picker";
import { ImageField } from "@/components/forms/image-field";
import { RichTextField } from "@/components/forms/rich-text-field";
import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-state";
import { GROUP_VISIBILITIES, type GroupVisibility } from "@/lib/domain";
import { createGroupAction, updateGroupAction } from "@/server/actions/groups";
import type { AuthorSummary, GroupDetail } from "@/server/types";

const VISIBILITY_HINTS: Record<GroupVisibility, { title: string; hint: string }> = {
  public: {
    title: "Public",
    hint: "Le groupe, son texte et ses membres se lisent depuis la page des groupes.",
  },
  prive: {
    title: "Privé",
    hint: "Seuls les membres voient le groupe, ses membres et ses scènes. Il n'apparaît dans aucune liste.",
  },
};

export function GroupForm({
  ownerId,
  group,
}: {
  /** Le meneur : les images du groupe sont rangées sous lui. */
  ownerId: string;
  group?: GroupDetail;
}) {
  const [state, formAction] = useActionState(
    group ? updateGroupAction : createGroupAction,
    idleState,
  );
  const errors = state.fieldErrors ?? {};

  const [visibility, setVisibility] = useState<GroupVisibility>(group?.visibility ?? "prive");
  const [members, setMembers] = useState<AuthorSummary[]>(group?.members ?? []);

  return (
    <form action={formAction} className="flex max-w-[760px] flex-col gap-8">
      {group ? <input type="hidden" name="id" value={group.id} /> : null}
      {members.map((member) => (
        <input key={member.id} type="hidden" name="memberIds[]" value={member.id} />
      ))}

      <section>
        <SectionHeading title="Le groupe" compact />
        <div className="flex flex-col gap-4">
          <Field label="Nom" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              defaultValue={group?.name ?? ""}
              placeholder="Cercle des Lanternes"
            />
          </Field>

          <Field
            label="Accroche"
            htmlFor="summary"
            hint="Deux lignes au plus : c'est ce que montre la liste."
            error={errors.summary}
          >
            <Textarea
              id="summary"
              name="summary"
              rows={2}
              maxLength={400}
              defaultValue={group?.summary ?? ""}
            />
          </Field>

          <RichTextField
            label="Description"
            name="description"
            folder="groupes"
            ownerId={ownerId}
            rows={8}
            defaultValue={group?.description}
            error={errors.description}
          />
        </div>
      </section>

      <section>
        <SectionHeading title="Qui voit ce groupe" compact />
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3 border-0 p-0">
            <legend className="sr-only">Visibilité du groupe</legend>
            {GROUP_VISIBILITIES.map((value) => (
              <ChoiceRow
                key={value}
                name="visibility"
                value={value}
                checked={visibility === value}
                onSelect={() => setVisibility(value)}
                title={VISIBILITY_HINTS[value].title}
                hint={VISIBILITY_HINTS[value].hint}
              />
            ))}
          </fieldset>
          <p className="caption text-ink-subtle">
            Dans les deux cas, c&apos;est vous qui ajoutez les membres, par leur pseudo. Personne
            ne rejoint de lui-même.
          </p>
        </div>
      </section>

      <section>
        <SectionHeading title={group ? "Membres" : "Premiers membres"} compact />
        <AccountPicker
          label="Ajouter par pseudo"
          inputId="membre"
          placeholder="Pseudo du membre"
          selected={members}
          excludeIds={[ownerId]}
          removeLabel={(name) => `Retirer ${name} du groupe`}
          onAdd={(account) =>
            setMembers((current) =>
              current.some((member) => member.id === account.id) ? current : [...current, account],
            )
          }
          onRemove={(id) => setMembers((current) => current.filter((member) => member.id !== id))}
          hint="Vous êtes membre de droit : vous ne figurez pas dans la liste."
          error={errors.memberIds}
        />
      </section>

      <section>
        <SectionHeading title="Bannière" compact />
        <ImageField
          label="Bannière du groupe"
          name="bannerUrl"
          altName="bannerAlt"
          folder="groupes"
          ownerId={ownerId}
          aspect="16 / 5"
          hint="Format 16:5, 1600 × 500 px au moins. 5 Mo au plus."
          defaultUrl={group?.bannerUrl}
          defaultAlt={group?.bannerAlt}
          error={errors.bannerUrl}
          altError={errors.bannerAlt}
        />
      </section>

      <FormMessage state={state} />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
          {group ? "ENREGISTRER LE GROUPE" : "CRÉER LE GROUPE"}
        </SubmitButton>
        <Button asChild variant="link" size="inline">
          <a href={group ? `/groupes/${group.slug}` : "/groupes"}>Annuler</a>
        </Button>
      </div>
    </form>
  );
}
