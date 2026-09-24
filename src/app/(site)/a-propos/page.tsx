import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { TILE_ATTRIBUTION } from "@/lib/map";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "À propos",
  description:
    "GW2RP Nexus est un hub communautaire de jeu de rôle dans l'univers de Guild Wars 2, tenu par des joueurs et non affilié à ArenaNet.",
  path: "/a-propos",
  keywords: ["GW2RP Nexus", "communauté roleplay Guild Wars 2"],
});

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-[840px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader
        eyebrow="GW2RP NEXUS"
        title="À propos"
        subtitle="Un hub communautaire, tenu par des joueurs, pour que les histoires qui se jouent en Tyrie aient un endroit où se lire."
      />

      <section className="mb-8">
        <SectionHeading title="Affiliation" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          GW2RP Nexus n'est affilié ni à ArenaNet, LLC ni à NCSOFT. Guild Wars 2 et l'ensemble
          de l'univers de Tyrie leur appartiennent. {TILE_ATTRIBUTION} Les textes et les
          images déposés ici restent à leurs auteurs.
        </p>
      </section>

      <section>
        <SectionHeading title="Un problème ?" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          Chaque contenu porte un drapeau de signalement. Pour tout le reste, la page{" "}
          <Link href="/signaler" className="text-crimson-ink underline underline-offset-4">
            signaler un contenu
          </Link>{" "}
          explique ce qui se passe ensuite.
        </p>
      </section>
    </div>
  );
}
