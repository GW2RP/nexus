"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState, type ActionState } from "@/lib/action-state";

/** Supprimer son propre contenu. La modale dit ce qui va disparaître avant de
 *  le faire : une suppression ne se déclenche jamais par inadvertance, et le
 *  focus arrive sur « Annuler ». */
export function DeleteContent({
  id,
  action,
  title,
  question,
  consequence,
  excerpt,
  verb,
}: {
  id: string;
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  /** Le nom du contenu, rappelé dans l'encart. */
  title: string;
  question: string;
  consequence: string;
  excerpt?: string | null;
  /** Le libellé de l'action destructrice, par son verbe. */
  verb: string;
}) {
  const [state, formAction] = useActionState(action, idleState);
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="quiet" size="sm">
          SUPPRIMER
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogTitle>{question}</AlertDialogTitle>
        <AlertDialogDescription className="mt-3">{consequence}</AlertDialogDescription>

        <div className="mt-4 border border-chip-edge bg-surface-inset p-4">
          <p className="font-display text-[18px] font-semibold">{title}</p>
          {excerpt ? (
            <p className="mt-1 meta text-ink-muted">{excerpt}</p>
          ) : null}
        </div>

        <FormMessage state={state} className="mt-4" />

        <form action={formAction} className="mt-6 flex justify-end gap-3">
          <input type="hidden" name="id" value={id} />
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" autoFocus>
              ANNULER
            </Button>
          </AlertDialogCancel>
          <SubmitButton pendingLabel="SUPPRESSION…">{verb}</SubmitButton>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
