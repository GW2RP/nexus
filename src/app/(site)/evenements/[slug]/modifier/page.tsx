import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EventForm } from "@/components/forms/event-form";
import { PageHeader } from "@/components/ui/page-header";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { getEventBySlug } from "@/server/queries/events";
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
  const [event, user] = await Promise.all([getEventBySlug(slug), getCurrentUser()]);
  if (!event) notFound();
  if (!user) redirect(`/connexion?suite=/evenements/${slug}/modifier`);
  if (!canEditContent(user, event.authorId)) redirect(`/evenements/${slug}`);

  const [places, characters] = await Promise.all([
    listPlaceOptions(),
    listCharactersOf(user.id),
  ]);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="AGENDA" title={`Modifier ${event.title}`} />
      <EventForm event={event} places={places} characters={characters} />
    </div>
  );
}
