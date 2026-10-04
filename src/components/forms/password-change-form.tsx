"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { errorState, idleState, successState, type ActionState } from "@/lib/action-state";
import { authClient } from "@/lib/auth-client";

/** Les refus de Better Auth arrivent en anglais : on les traduit par leur code. */
const MESSAGES: Record<string, string> = {
  INVALID_PASSWORD: "Le mot de passe actuel n'est pas le bon.",
  PASSWORD_TOO_SHORT: "Le nouveau mot de passe doit compter dix caractères au moins.",
  PASSWORD_TOO_LONG: "Le nouveau mot de passe dépasse 128 caractères.",
  CREDENTIAL_ACCOUNT_NOT_FOUND: "Ce compte n'a pas de mot de passe à changer.",
};

/** Changer son propre mot de passe : l'ancien le prouve, et les autres sessions
 *  du compte se ferment — l'application bureau comprise. Un mot de passe qu'on
 *  change parce qu'il a fuité ne doit pas laisser ouverte la session de celui
 *  qui l'a trouvé. */
export function PasswordChangeForm() {
  const [state, setState] = useState<ActionState>(idleState);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setState(idleState);

    const form = formEvent.currentTarget;
    const formData = new FormData(form);
    const newPassword = String(formData.get("newPassword") ?? "");
    if (newPassword !== String(formData.get("newPasswordConfirm") ?? "")) {
      setState(errorState("Les deux mots de passe ne sont pas identiques."));
      return;
    }

    setPending(true);
    const result = await authClient.changePassword({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword,
      revokeOtherSessions: true,
    });

    if (result.error) {
      setState(
        errorState(
          (result.error.code && MESSAGES[result.error.code]) ||
            "Le changement n'a pas abouti. Réessayez.",
        ),
      );
      setPending(false);
      return;
    }

    form.reset();
    setState(successState("Le mot de passe est changé. Vos autres sessions sont fermées."));
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Mot de passe actuel" htmlFor="currentPassword" required>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </Field>

      <Field
        label="Nouveau mot de passe"
        htmlFor="newPassword"
        required
        hint="Dix caractères au moins."
      >
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
        />
      </Field>

      <Field label="Confirmer le nouveau mot de passe" htmlFor="newPasswordConfirm" required>
        <Input
          id="newPasswordConfirm"
          name="newPasswordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
        />
      </Field>

      <FormMessage state={state} />

      <Button type="submit" size="lead" disabled={pending}>
        {pending ? "ENREGISTREMENT…" : "CHANGER LE MOT DE PASSE"}
      </Button>
    </form>
  );
}
