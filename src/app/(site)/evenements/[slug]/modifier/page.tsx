import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { getEventBySlug } from "@/server/queries/events";
import { listGroupsLedBy } from "@/server/queries/groups";
import { listPlaceOptions } from "@/server/queries/places";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata({
    title: "Modifier l'annonce",
    description: "Modifier une annonce de l'agenda.",
    path: `/evenements/${slug}/modifier`,
    noIndex: true,
  });
}

export default async function EditEventPage({ params }: Props) {
  const { slug } = await params;
  // La session se lit avant l'annonce : une scène privée est introuvable pour
  // qui ne la voit pas, son auteur compris s'il n'est pas reconnu.
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?suite=/evenements/${slug}/modifier`);

  const event = await getEventBySlug(slug, user);
  if (!event) notFound();
  if (!canEditContent(user, event.authorId)) redirect(`/evenements/${slug}`);

  const [places, characters, groups] = await Promise.all([
    listPlaceOptions(),
    listCharactersOf(user.id),
    listGroupsLedBy(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader eyebrow="AGENDA" title={`Modifier ${event.title}`} />
      <EventForm
        ownerId={event.authorId}
        event={event}
        places={places}
        characters={characters}
        groups={groups}
        invited={event.invited}
      />
    </div>
  );
}
