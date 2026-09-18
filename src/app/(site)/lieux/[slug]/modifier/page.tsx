import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PlaceForm } from "@/components/forms/place-form";
import { PageHeader } from "@/components/ui/page-header";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";
import { getPlaceBySlug } from "@/server/queries/places";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata({
    title: "Modifier le lieu",
    description: "Modifier une fiche du registre des lieux.",
    path: `/lieux/${slug}/modifier`,
    noIndex: true,
  });
}

export default async function EditPlacePage({ params }: Props) {
  const { slug } = await params;
  const [place, user] = await Promise.all([getPlaceBySlug(slug), getCurrentUser()]);
  if (!place) notFound();
  if (!user) redirect(`/connexion?suite=/lieux/${slug}/modifier`);
  if (!canEditContent(user, place.authorId)) redirect(`/lieux/${slug}`);

  const characters = await listCharactersOf(user.id);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="REGISTRE DES LIEUX" title={`Modifier ${place.name}`} />
      <PlaceForm place={place} characters={characters} />
    </div>
  );
}
