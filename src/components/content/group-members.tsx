"use client";

import { useState, useTransition } from "react";

import { AccountPicker } from "@/components/forms/account-picker";
import { CloseIcon } from "@/components/icons";
import { RoundPortrait } from "@/components/ui/framed-media";
import { FormMessage } from "@/components/ui/form-message";
import { idleState, type ActionState } from "@/lib/action-state";
import { toggleGroupMemberAction } from "@/server/actions/groups";
import type { AuthorSummary } from "@/server/types";

/** Les membres d'un cercle, et le champ qui en ajoute.
 *
 *  Le meneur est nommé à part : il est membre de droit, et ne se retire pas de
 *  son propre groupe — il le dissout. */
export function GroupMembers({
  groupId,
  leader,
  members,
  canManage,
}: {
  groupId: string;
  leader: AuthorSummary | null;
  members: AuthorSummary[];
  canManage: boolean;
}) {
  const [state, setState] = useState<ActionState>(idleState);
  const [, startTransition] = useTransition();

  function basculer(userId: string, retirer: boolean) {
    const data = new FormData();
    data.set("groupId", groupId);
    data.set("userId", userId);
    if (retirer) data.set("retirer", "1");
    startTransition(async () => setState(await toggleGroupMemberAction(idleState, data)));
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="grid gap-x-8 sm:grid-cols-2">
        {leader ? (
          <li className="flex items-center gap-3 border-b border-hairline py-3">
            <RoundPortrait size={40} />
            <span className="min-w-0 grow">
              <span className="block font-display text-[17px] text-ink">{leader.name}</span>
              <span className="block caption text-ink-muted">Meneur du cercle</span>
            </span>
          </li>
        ) : null}

        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 border-b border-hairline py-3">
            <RoundPortrait size={40} />
            <span className="min-w-0 grow">
              <span className="block font-display text-[17px] text-ink">{member.name}</span>
              <span className="block caption text-ink-muted">Membre</span>
            </span>
            {canManage ? (
              <button
                type="button"
                onClick={() => basculer(member.id, true)}
                aria-label={`Retirer ${member.name} du groupe`}
                className="flex size-tap shrink-0 items-center justify-center text-ink-subtle hover:text-crimson-ink"
              >
                <CloseIcon size={14} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage ? (
        <div className="border border-rule bg-surface-inset p-5">
          <AccountPicker
            label="Ajouter un membre"
            inputId="ajouter-membre"
            placeholder="Pseudo du membre"
            selected={[]}
            excludeIds={[
              ...(leader ? [leader.id] : []),
              ...members.map((member) => member.id),
            ]}
            removeLabel={(name) => `Retirer ${name} du groupe`}
            onAdd={(account) => basculer(account.id, false)}
            onRemove={() => undefined}
          />
          <FormMessage state={state} className="mt-3" />
        </div>
      ) : null}
    </div>
  );
}
