"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  className,
  capitales = false,
}: {
  className?: string;
  /** Le bouton paraît en action encadrée sur le compte, en lien dans le menu.
   *  Les capitales s'écrivent donc dans le texte rendu, pas en `text-transform`
   *  au gré de l'appelant : un lecteur d'écran doit lire ce qui est affiché. */
  capitales?: boolean;
}) {
  const dire = (texte: string) => (capitales ? texte.toLocaleUpperCase("fr-FR") : texte);
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
      {busy || pending
        ? dire("Déconnexion…")
        : error
          ? dire("Réessayer la déconnexion")
          : dire("Se déconnecter")}
      {error ? (
        <span id="deconnexion-erreur" className="sr-only">
          La déconnexion n'a pas abouti. Réessayez.
        </span>
      ) : null}
    </button>
  );
}
