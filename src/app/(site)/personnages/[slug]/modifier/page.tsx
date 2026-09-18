import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { CharacterForm } from "@/components/forms/character-form";
import { PageHeader } from "@/components/ui/page-header";
import { canEditContent } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { getCharacterBySlug } from "@/server/queries/characters";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata({
    title: "Modifier la fiche",
    description: "Modifier une fiche du registre des personnages.",
    path: `/personnages/${slug}/modifier`,
    noIndex: true,
  });
}

export default async function EditCharacterPage({ params }: Props) {
  const { slug } = await params;
  const [character, user] = await Promise.all([getCharacterBySlug(slug), getCurrentUser()]);
  if (!character) notFound();
  if (!user) redirect(`/connexion?suite=/personnages/${slug}/modifier`);
  if (!canEditContent(user, character.authorId)) redirect(`/personnages/${slug}`);

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader eyebrow="REGISTRE DES PERSONNAGES" title={`Modifier ${character.name}`} />
      <CharacterForm character={character} />
    </div>
  );
}
