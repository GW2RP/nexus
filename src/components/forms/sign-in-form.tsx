"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export function SignInForm({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData(formEvent.currentTarget);
    const result = await authClient.signIn.email({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      rememberMe: formData.get("rememberMe") === "on",
    });

    if (result.error) {
      setError(
        result.error.message ??
          "L'adresse ou le mot de passe ne correspond pas. Réessayez.",
      );
      setPending(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Adresse électronique" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.fr"
        />
      </Field>

      <Field label="Mot de passe" htmlFor="password" required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
        />
      </Field>

      <label className="flex min-h-tap items-center gap-3 text-[17px] text-ink-body">
        <input
          type="checkbox"
          name="rememberMe"
          defaultChecked
          className="size-[18px] accent-[var(--crimson)]"
        />
        Rester connecté sur cet appareil
      </label>

      {error ? (
        <p role="alert" className="border border-crimson-edge bg-surface-inset px-4 py-3 text-[17px] text-crimson-ink">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lead" disabled={pending}>
        {pending ? "CONNEXION…" : "SE CONNECTER"}
      </Button>

      <p className="text-[17px] text-ink-body">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-crimson-ink underline underline-offset-4">
          En créer un
        </Link>
        .
      </p>
    </form>
  );
}
