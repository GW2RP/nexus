"use client";

import { useActionState, useEffect, useRef } from "react";

import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { idleState } from "@/lib/action-state";
import { setUserPasswordAction } from "@/server/actions/account";

/** Le mot de passe d'un autre compte, posé par l'administration. Pas d'ancien
 *  mot de passe à fournir : c'est justement celui qu'on a perdu. */
export function AdminPasswordForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(
    setUserPasswordAction.bind(null, userId),
    idleState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Un mot de passe posé ne reste pas affiché dans le formulaire.
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nouveau mot de passe"
        htmlFor="password"
        required
        hint="Dix caractères au moins."
        error={state.fieldErrors?.password}
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
      </Field>

      <Field
        label="Confirmer le mot de passe"
        htmlFor="passwordConfirm"
        required
        error={state.fieldErrors?.passwordConfirm}
      >
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          aria-invalid={state.fieldErrors?.passwordConfirm ? true : undefined}
        />
      </Field>

      <FormMessage state={state} />

      <SubmitButton size="lead" pendingLabel="ENREGISTREMENT…">
        CHANGER LE MOT DE PASSE
      </SubmitButton>
    </form>
  );
}
