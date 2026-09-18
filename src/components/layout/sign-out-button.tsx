"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { authClient } from "@/lib/auth-client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    await authClient.signOut();
    startTransition(() => {
      router.refresh();
      router.push("/");
    });
    setBusy(false);
  }

  return (
    <button type="button" onClick={handleSignOut} className={className}>
      {busy || pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
