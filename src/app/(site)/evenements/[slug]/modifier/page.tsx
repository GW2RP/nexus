import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { getEventBySlug } from "@/server/queries/events";
import { listGroupsOf } from "@/server/queries/groups";
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
    // L'organisateur est l'un des personnages de l'auteur, même quand c'est
    // l'administration qui corrige l'annonce.
    listCharactersOf(event.authorId),
    listGroupsOf(user.id),
  ]);

  // Le groupe déjà associé reste proposé même quand on n'en est pas — c'est
  // l'administration qui corrige, ou un membre parti depuis : sans lui, la
  // liste le tairait et l'enregistrement le retirerait sans qu'on l'ait choisi.
  const proposes =
    event.group && !groups.some((group) => group.id === event.group?.id)
      ? [...groups, { id: event.group.id, slug: event.group.slug, name: event.group.name, memberCount: null }]
      : groups;

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader eyebrow="AGENDA" title={`Modifier ${event.title}`} />
      <EventForm
        ownerId={event.authorId}
        event={event}
        places={places}
        characters={characters}
        groups={proposes}
        invited={event.invited}
      />
    </div>
  );
}
