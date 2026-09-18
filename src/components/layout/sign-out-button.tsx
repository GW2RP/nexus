"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    setError(false);
    try {
      await authClient.signOut();
      startTransition(() => {
        router.refresh();
        router.push("/");
      });
    } catch {
      // Réseau coupé ou serveur muet : le bouton doit redevenir cliquable,
      // sinon la personne reste bloquée sur « Déconnexion… ».
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className={className}
      aria-describedby={error ? "deconnexion-erreur" : undefined}
    >
      {busy || pending ? "Déconnexion…" : error ? "Réessayer la déconnexion" : "Se déconnecter"}
      {error ? (
        <span id="deconnexion-erreur" className="sr-only">
          La déconnexion n'a pas abouti. Réessayez.
        </span>
      ) : null}
    </button>
  );
}
