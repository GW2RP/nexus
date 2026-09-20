"use client";

import { useState, useTransition } from "react";

import { AccountPicker } from "@/components/forms/account-picker";
import { CloseIcon, LinkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/chip";
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
import {
  inviteToEventAction,
  regenerateShareCodeAction,
} from "@/server/actions/events";
import type { AuthorSummary } from "@/server/types";

/** Le partage d'une scène privée, vu par celui qui l'organise : le lien et son
 *  code, et les comptes invités nommément.
 *
 *  Le lien arrive tout fait du serveur : le composer avec `window.location`
 *  donnerait une adresse différente au premier rendu et après l'hydratation. */
export function EventSharePanel({
  eventId,
  shareUrl,
  shareCode,
  invited,
  authorId,
  registeredIds,
}: {
  eventId: string;
  shareUrl: string;
  shareCode: string;
  invited: AuthorSummary[];
  authorId: string;
  /** Les comptes déjà inscrits : la pastille le dit, plutôt que « invité ». */
  registeredIds: string[];
}) {
  const [copie, setCopie] = useState<"non" | "faite" | "impossible">("non");
  const [state, setState] = useState<ActionState>(idleState);
  const [, startTransition] = useTransition();

  function inviter(userId: string, retirer: boolean) {
    const data = new FormData();
    data.set("eventId", eventId);
    data.set("userId", userId);
    if (retirer) data.set("retirer", "1");
    startTransition(async () => setState(await inviteToEventAction(idleState, data)));
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopie("faite");
    } catch {
      // Un navigateur peut refuser le presse-papiers. On le dit plutôt que de
      // laisser croire que le lien est copié.
      setCopie("impossible");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-[10px] border border-rule bg-surface-inset px-[14px] py-3">
        <LinkIcon size={16} className="text-ink-subtle" />
        <span className="break-all text-[16px] text-ink">{shareUrl}</span>
      </div>

      <Button type="button" onClick={copier}>
        COPIER LE LIEN
      </Button>

      <p className="caption text-ink-muted" aria-live="polite">
        {copie === "faite"
          ? "Le lien est dans le presse-papiers."
          : copie === "impossible"
            ? "Le presse-papiers a été refusé : copiez le lien à la main."
            : "Qui a ce lien peut lire l'annonce et s'inscrire, même sans invitation nominative."}
      </p>

      <div className="h-px bg-hairline" />

      <ChangeCode eventId={eventId} shareCode={shareCode} />

      <div className="h-px bg-hairline" />

      <div className="flex flex-col gap-3">
        <p className="panel-title">
          {invited.length > 0 ? `Invités · ${invited.length}` : "Invités"}
        </p>

        {invited.length > 0 ? (
          <ul>
            {invited.map((guest) => (
              <li
                key={guest.id}
                className="flex items-center gap-3 border-b border-hairline py-[10px] last:border-b-0"
              >
                <span className="grow text-[17px] text-ink">{guest.name}</span>
                {registeredIds.includes(guest.id) ? (
                  <StatusBadge tone="success">INSCRIT</StatusBadge>
                ) : (
                  <StatusBadge>INVITÉ</StatusBadge>
                )}
                <button
                  type="button"
                  onClick={() => inviter(guest.id, true)}
                  aria-label={`Retirer ${guest.name} des invités`}
                  className="flex size-tap shrink-0 items-center justify-center text-ink-subtle hover:text-crimson-ink"
                >
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <AccountPicker
          label="Inviter par pseudo"
          inputId="inviter-compte"
          placeholder="Pseudo du membre"
          selected={[]}
          excludeIds={[authorId, ...invited.map((guest) => guest.id)]}
          removeLabel={(name) => `Retirer ${name} des invités`}
          onAdd={(account) => inviter(account.id, false)}
          onRemove={() => undefined}
        />

        <FormMessage state={state} />
      </div>
    </div>
  );
}

/** Changer le code ferme l'ancien lien. C'est irréversible pour ceux qui
 *  l'avaient : la modale le dit avant, pas après. */
function ChangeCode({ eventId, shareCode }: { eventId: string; shareCode: string }) {
  const [state, setState] = useState<ActionState>(idleState);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <div>
        <AlertDialogTrigger asChild>
          <Button variant="link" size="inline">
            Changer le code
          </Button>
        </AlertDialogTrigger>
        <p className="caption mt-[6px] text-ink-muted">
          L&apos;ancien lien cesse d&apos;ouvrir l&apos;annonce. Les inscriptions déjà prises restent.
        </p>
        <FormMessage state={state} className="mt-3" />
      </div>

      <AlertDialogContent>
        <AlertDialogTitle>Changer le code de partage ?</AlertDialogTitle>
        <AlertDialogDescription className="mt-3">
          Le lien qui circule cessera d&apos;ouvrir cette annonce, pour tout le monde. Les
          personnes déjà inscrites et les invités nommés gardent leur accès.
        </AlertDialogDescription>

        <div className="mt-4 border border-chip-edge bg-surface-inset p-4">
          <p className="font-display text-[18px] font-semibold tracking-[1px]">{shareCode}</p>
          <p className="mt-1 meta text-ink-muted">Le code actuel</p>
        </div>

        <form
          className="mt-6 flex justify-end gap-3"
          action={(data: FormData) => {
            data.set("eventId", eventId);
            startTransition(async () => {
              setState(await regenerateShareCodeAction(idleState, data));
              setOpen(false);
            });
          }}
        >
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline" autoFocus>
              ANNULER
            </Button>
          </AlertDialogCancel>
          <SubmitButton pendingLabel="CHANGEMENT…">CHANGER LE CODE</SubmitButton>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
