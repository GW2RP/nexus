"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceRow } from "@/components/ui/choice-row";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-state";
import {
  BOARD_NAME_MAX,
  BOARD_VISIBILITIES,
  BOARD_VISIBILITY_LABELS,
  type BoardVisibility,
} from "@/lib/boards";
import {
  createGroupBoardAction,
  openPlaceBoardAction,
  updateBoardAction,
} from "@/server/actions/boards";

/** Ce que chaque visibilité entraîne. Elle dit qui **lit** le panneau : dans
 *  les deux cas, ce sont les membres qui y écrivent. */
const VISIBILITY_HINTS: Record<BoardVisibility, string> = {
  membres: "Les autres ne le voient pas.",
  public: "Qui voit le groupe le lit ; seuls ses membres y écrivent.",
};

function BoardFields({
  name,
  visibility,
  errors,
}: {
  name?: string;
  visibility: BoardVisibility;
  errors?: Record<string, string>;
}) {
  const [choice, setChoice] = useState<BoardVisibility>(visibility);
  return (
    <>
      <Field label="Nom du panneau" htmlFor="board-name" required error={errors?.name}>
        <Input id="board-name" name="name" defaultValue={name} maxLength={BOARD_NAME_MAX} required />
      </Field>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 meta text-ink-muted">Visibilité</legend>
        {BOARD_VISIBILITIES.map((value) => (
          <ChoiceRow
            key={value}
            name="visibility"
            value={value}
            checked={choice === value}
            onSelect={() => setChoice(value)}
            title={BOARD_VISIBILITY_LABELS[value]}
            hint={VISIBILITY_HINTS[value]}
          />
        ))}
      </fieldset>
    </>
  );
}

/** Ouvrir un panneau dans un groupe. C'est au meneur. */
export function NewBoardDialog({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [state, formAction] = useActionState(createGroupBoardAction, idleState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">NOUVEAU PANNEAU</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <p className="eyebrow text-gold-eyebrow">{groupName.toLocaleUpperCase("fr-FR")}</p>
        <DialogTitle className="mt-2">Nouveau panneau</DialogTitle>
        <form action={formAction} className="mt-6 flex flex-col gap-5">
          <input type="hidden" name="groupId" value={groupId} />
          <BoardFields visibility="membres" errors={state.fieldErrors} />
          <FormMessage state={state} />
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                ANNULER
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="OUVERTURE…">OUVRIR LE PANNEAU</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Renommer un panneau de groupe, ou changer qui le lit. */
export function BoardSettingsDialog({
  boardId,
  name,
  visibility,
}: {
  boardId: string;
  name: string;
  visibility: BoardVisibility;
}) {
  const [state, formAction] = useActionState(updateBoardAction, idleState);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          PARAMÈTRES
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Paramètres du panneau</DialogTitle>
        <form action={formAction} className="mt-6 flex flex-col gap-5">
          <input type="hidden" name="id" value={boardId} />
          <BoardFields name={name} visibility={visibility} errors={state.fieldErrors} />
          <FormMessage state={state} />
          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                FERMER
              </Button>
            </DialogClose>
            <SubmitButton variant="outline" pendingLabel="ENREGISTREMENT…">
              ENREGISTRER
            </SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ouvrir le panneau d'un lieu : un seul geste, pas de réglage — il est public
 *  et porte le nom du lieu. */
export function OpenPlaceBoardButton({ placeId }: { placeId: string }) {
  const [state, formAction] = useActionState(openPlaceBoardAction, idleState);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="placeId" value={placeId} />
      <FormMessage state={state} />
      <SubmitButton variant="outline" pendingLabel="OUVERTURE…">
        OUVRIR LE PANNEAU
      </SubmitButton>
    </form>
  );
}
