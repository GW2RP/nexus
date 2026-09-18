"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function SignUpForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    const formData = new FormData(formEvent.currentTarget);
    const password = String(formData.get("password") ?? "");
    if (password !== String(formData.get("passwordConfirm") ?? "")) {
      setError("Les deux mots de passe ne sont pas identiques.");
      return;
    }

    setPending(true);
    const result = await authClient.signUp.email({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password,
    });

    if (result.error) {
      setError(
        result.error.message ??
          "La création du compte n'a pas abouti. Cette adresse est peut-être déjà prise.",
      );
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field
        label="Pseudonyme"
        htmlFor="name"
        required
        hint="C'est ce nom qui signe vos fiches, vos lieux et vos annonces."
      >
        <Input
          id="name"
          name="name"
          autoComplete="nickname"
          required
          minLength={2}
          maxLength={60}
        />
      </Field>

      <Field label="Adresse électronique" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field
        label="Mot de passe"
        htmlFor="password"
        required
        hint="Dix caractères au moins."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
        />
      </Field>

      <Field label="Confirmer le mot de passe" htmlFor="passwordConfirm" required>
        <Input
          id="passwordConfirm"
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
        />
      </Field>

      {error ? (
        <p role="alert" className="border border-crimson-edge bg-surface-inset px-4 py-3 text-[17px] text-crimson-ink">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lead" disabled={pending}>
        {pending ? "CRÉATION…" : "CRÉER MON COMPTE"}
      </Button>

      <p className="text-[17px] text-ink-body">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-crimson-ink underline underline-offset-4">
          Se connecter
        </Link>
        .
      </p>
    </form>
  );
}
