"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/** Lier son compte Discord au hub : c'est ce lien qui reconnaît le joueur dans
 *  l'activité Discord, et qui lui ouvre le droit d'y écrire. Discord n'ouvre
 *  pas de session sur le site par ce chemin. */
/** `linkId` : le lien chez Better Auth, s'il existe. */
export function DiscordLink({ linkId: discordId }: { linkId: string | null }) {
  const linked = discordId !== null;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link() {
    setBusy(true);
    setError(null);
    const { error: failure } = await authClient.linkSocial({ provider: "discord", callbackURL: "/mon-compte" });
    if (failure) {
      setError(failure.message ?? "Discord n'a pas pu être lié.");
      setBusy(false);
    }
  }

  async function unlink() {
    setBusy(true);
    setError(null);
    if (!discordId) return;
    const { error: failure } = await authClient.unlinkAccount({ accountId: discordId });
    setBusy(false);
    if (failure) {
      setError(failure.message ?? "Discord n'a pas pu être délié.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <p className="body-compact text-ink">{linked ? "Lié" : "Non lié"}</p>
      <Button variant="outline" size="sm" onClick={linked ? unlink : link} disabled={busy}>
        {linked ? "DÉLIER DISCORD" : "LIER DISCORD"}
      </Button>
      {error ? (
        <p role="alert" className="meta text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
