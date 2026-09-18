import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CharacterForm } from "@/components/forms/character-form";
import { PageHeader } from "@/components/ui/page-header";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = buildMetadata({
  title: "Créer un personnage",
  description: "Ouvrir une fiche au registre des personnages du hub GW2RP Nexus.",
  path: "/personnages/nouveau",
  noIndex: true,
});

export default async function NewCharacterPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/personnages/nouveau");
  if (!canContribute(user)) redirect("/personnages");

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="REGISTRE DES PERSONNAGES"
        title="Créer un personnage"
        subtitle="Rien n'est inventé à l'affichage : ce que vous laissez vide reste vide, avec un placeholder explicite."
      />
      <CharacterForm />
    </div>
  );
}
