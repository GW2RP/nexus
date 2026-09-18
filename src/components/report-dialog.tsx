"use client";

import { useActionState, useEffect, useState } from "react";

import { FlagIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Label, Select, Textarea } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportTarget } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { idleState } from "@/lib/action-state";
import { createReportAction } from "@/server/actions/reports";

/** Le signalement d'un contenu : un drapeau discret en `ink-subtle`, jamais un
 *  bouton rouge — on ne met pas en scène la dénonciation. */
export function ReportDialog({
  targetType,
  targetId,
  targetSlug,
  label,
  withLabel = false,
  className,
}: {
  targetType: ReportTarget;
  targetId: string;
  targetSlug?: string;
  /** L'`aria-label` explicite : « Signaler cette rumeur », « Signaler ce lieu ». */
  label: string;
  withLabel?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createReportAction, idleState);

  useEffect(() => {
    if (state.status === "success") {
      const timer = setTimeout(() => setOpen(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [state.status]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex min-h-tap items-center justify-center gap-2 text-ink-subtle hover:text-ink-muted",
            withLabel ? "px-2 text-[16px] text-ink-muted" : "size-tap",
            className,
          )}
        >
          <FlagIcon size={15} />
          {withLabel ? <span>Signaler</span> : null}
        </button>
      </DialogTrigger>

      <DialogContent aria-describedby="signalement-description">
        <DialogTitle>Signaler ce contenu ?</DialogTitle>
        <DialogDescription id="signalement-description" className="mt-3">
          L'équipe reçoit le motif, votre commentaire et un extrait du contenu. Elle regarde
          les signalements sous 24 h. L'auteur n'est pas prévenu de votre nom.
        </DialogDescription>

        <form action={formAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          {targetSlug ? <input type="hidden" name="targetSlug" value={targetSlug} /> : null}

          <Field label="Motif" htmlFor="report-reason" required>
            <Select id="report-reason" name="reason" required defaultValue="">
              <option value="" disabled>
                Choisissez un motif
              </option>
              {REPORT_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {REPORT_REASON_LABELS[reason]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-col gap-2">
            <Label htmlFor="report-comment">Commentaire</Label>
            <Textarea
              id="report-comment"
              name="comment"
              rows={3}
              maxLength={2000}
              placeholder="Ce qui pose problème, en une ou deux phrases."
            />
          </div>

          <FormMessage state={state} />

          <div className="flex justify-end gap-3">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                ANNULER
              </Button>
            </DialogClose>
            <SubmitButton pendingLabel="ENVOI…">ENVOYER LE SIGNALEMENT</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
