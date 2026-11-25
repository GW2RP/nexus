import type { Metadata } from "next";

import { DiscordActivity } from "@/components/discord/discord-activity";
import { env } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Activité Discord",
  description: "Le panneau du hub, partagé dans un salon Discord.",
  path: "/discord",
  noIndex: true,
});

/** L'hôte public du magasin d'images. Dans l'activité, la CSP de Discord ne
 *  laisse passer que ce qui transite par son proxy : les images du magasin s'y
 *  servent par la correspondance `/stockage`, qu'il faut donc savoir écrire.
 *  Le jeton du magasin le porte : `vercel_blob_rw_<magasin>_<secret>`. */
function blobHost(): string {
  if (process.env.BLOB_PUBLIC_HOST) return process.env.BLOB_PUBLIC_HOST;
  const store = /^vercel_blob_rw_([^_]+)_/.exec(process.env.BLOB_READ_WRITE_TOKEN ?? "")?.[1];
  return store ? `${store.toLowerCase()}.public.blob.vercel-storage.com` : "";
}

/** Ce que Discord ouvre quand on lance l'activité : `proxy.ts` y réécrit la
 *  racine. Hors de Discord, la page dit seulement qu'elle s'y lance. */
export default async function DiscordActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <DiscordActivity
      clientId={env.discordClientId}
      blobHost={blobHost()}
      inDiscord={typeof params.frame_id === "string"}
    />
  );
}
