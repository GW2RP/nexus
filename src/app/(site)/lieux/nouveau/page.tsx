import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlaceForm } from "@/components/forms/place-form";
import { PageHeader } from "@/components/ui/page-header";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";

export const metadata: Metadata = buildMetadata({
  title: "Proposer un lieu",
  description: "Poser un lieu sur la carte de Tyrie.",
  path: "/lieux/nouveau",
  noIndex: true,
});

export default async function NewPlacePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/lieux/nouveau");
  if (!canContribute(user)) redirect("/lieux");

  const characters = await listCharactersOf(user.id);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="REGISTRE DES LIEUX"
        title="Proposer un lieu"
      />
      <PlaceForm characters={characters} />
    </div>
  );
}
