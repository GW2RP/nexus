"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
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
import { idleState } from "@/lib/action-state";
import { resolveReportAction } from "@/server/actions/reports";
import type { ReportRow } from "@/server/types";

const DECISIONS = [
  { value: "rejeter", label: "Rejeter le signalement", destructive: false },
  { value: "avertir", label: "Avertir l'auteur", destructive: false },
  { value: "masquer", label: "Masquer le contenu", destructive: true },
  { value: "supprimer", label: "Supprimer le contenu", destructive: true },
  { value: "suspendre", label: "Suspendre le compte de l'auteur", destructive: true },
] as const;

const CONSEQUENCES: Record<string, string> = {
  rejeter:
    "Le contenu reste en ligne. Les autres signalements du même contenu se referment avec celui-ci.",
  avertir:
    "Le contenu reste en ligne et son auteur reçoit le motif. La décision est inscrite au journal.",
  masquer:
    "Le contenu disparaît du hub mais reste en base : l'équipe peut le rétablir. L'auteur n'y a plus accès.",
  supprimer:
    "Le contenu disparaît définitivement du hub : fiche, annonce ou rumeur, avec ses inscriptions. C'est irréversible.",
  suspendre:
    "Le contenu est masqué et le compte de son auteur est suspendu trente jours : il lit le hub, il n'y publie plus.",
};

/** Le panneau de décision : cadre 2 px `gold`, motif obligatoire, et une modale
 *  pour tout ce qui est destructeur. Le focus arrive sur « Annuler ». */
export function ModerationDecision({ report }: { report: ReportRow }) {
  const [state, formAction] = useActionState(resolveReportAction, idleState);
  const [decision, setDecision] = useState<string>("rejeter");
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(false);
  const [open, setOpen] = useState(false);

  const selected = DECISIONS.find((item) => item.value === decision)!;
  const reasonTooShort = reason.trim().length < 10;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Décision" htmlFor="decision" required>
        <Select
          id="decision"
          value={decision}
          onChange={(event) => setDecision(event.target.value)}
        >
          {DECISIONS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>

      <p className="border-l-2 border-gold pl-4 text-[17px] leading-[1.5] text-ink-body">
        {CONSEQUENCES[decision]}
      </p>

      <Field
        label="Motif"
        htmlFor="reason"
        required
        hint="Inscrit au journal avec votre nom et la date. Une phrase suffit."
      >
        <Textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
        />
      </Field>

      <label className="flex min-h-tap items-center gap-3 text-[17px] text-ink-body">
        <input
          type="checkbox"
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
          className="size-[18px] accent-[var(--crimson)]"
        />
        Prévenir l'auteur en lui donnant le motif
      </label>

      <FormMessage state={state} />

      {selected.destructive ? (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button disabled={reasonTooShort}>{selected.label.toLocaleUpperCase("fr-FR")}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{selected.label} ?</AlertDialogTitle>
            <AlertDialogDescription className="mt-3">
              {CONSEQUENCES[decision]}
            </AlertDialogDescription>

            <div className="mt-4 border border-chip-edge bg-surface-inset p-4">
              <p className="text-[17px] italic leading-[1.5] text-ink-body">
                {report.targetExcerpt ?? "Contenu supprimé depuis le signalement."}
              </p>
              <p className="mt-2 text-[15px] text-ink-muted">
                Signalé par {report.reporter?.name ?? "un compte supprimé"} ·{" "}
                {new Date(report.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </div>

            <form action={formAction} className="mt-6 flex justify-end gap-3">
              <input type="hidden" name="reportId" value={report.id} />
              <input type="hidden" name="decision" value={decision} />
              <input type="hidden" name="reason" value={reason} />
              {notify ? <input type="hidden" name="notifyAuthor" value="on" /> : null}
              <AlertDialogCancel asChild>
                <Button type="button" variant="outline" autoFocus>
                  ANNULER
                </Button>
              </AlertDialogCancel>
              <SubmitButton pendingLabel="EN COURS…">
                {decision === "supprimer"
                  ? "SUPPRIMER DÉFINITIVEMENT"
                  : decision === "suspendre"
                    ? "SUSPENDRE LE COMPTE"
                    : "MASQUER LE CONTENU"}
              </SubmitButton>
            </form>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="reportId" value={report.id} />
          <input type="hidden" name="decision" value={decision} />
          <input type="hidden" name="reason" value={reason} />
          {notify ? <input type="hidden" name="notifyAuthor" value="on" /> : null}
          <SubmitButton pendingLabel="EN COURS…">
            {selected.label.toLocaleUpperCase("fr-FR")}
          </SubmitButton>
        </form>
      )}

      {reasonTooShort ? (
        <p className="text-[15px] text-ink-muted">
          Le motif est inscrit au journal : il faut dix caractères au moins.
        </p>
      ) : null}
    </div>
  );
}
