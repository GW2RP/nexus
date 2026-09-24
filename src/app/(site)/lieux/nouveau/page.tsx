import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PlaceForm } from "@/components/forms/place-form";
import { PageHeader } from "@/components/ui/page-header";
import { readPointParam } from "@/lib/map";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOfMany } from "@/server/queries/characters";

export const metadata: Metadata = buildMetadata({
  title: "Proposer un lieu",
  description: "Poser un lieu sur la carte de Tyrie.",
  path: "/lieux/nouveau",
  noIndex: true,
});

export default async function NewPlacePage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string; y?: string }>;
}) {
  const { x, y } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/lieux/nouveau");
  if (!canContribute(user)) redirect("/lieux");

  const keeperOptions = await listCharactersOfMany([user.id]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader
        eyebrow="REGISTRE DES LIEUX"
        title="Proposer un lieu"
      />
      <PlaceForm
        ownerId={user.id}
        keeperOptions={keeperOptions}
        canChangeTeam
        initialCoordinates={readPointParam(x, y)}
      />
    </div>
  );
}
