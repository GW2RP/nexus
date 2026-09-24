import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { readPointParam } from "@/lib/map";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { listGroupsLedBy } from "@/server/queries/groups";
import { listPlaceOptions } from "@/server/queries/places";

export const metadata: Metadata = buildMetadata({
  title: "Proposer un évènement",
  description: "Annoncer une scène à l'agenda du hub GW2RP Nexus.",
  path: "/evenements/nouveau",
  noIndex: true,
});

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string; y?: string }>;
}) {
  const { x, y } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/evenements/nouveau");
  if (!canContribute(user)) redirect("/evenements");

  const [places, characters, groups] = await Promise.all([
    listPlaceOptions(),
    listCharactersOf(user.id),
    listGroupsLedBy(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader
        eyebrow="AGENDA"
        title="Proposer un évènement"
      />
      <EventForm
        ownerId={user.id}
        places={places}
        characters={characters}
        groups={groups}
        initialCoordinates={readPointParam(x, y)}
      />
    </div>
  );
}
