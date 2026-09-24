import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/domain";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Signaler un contenu",
  description:
    "Comment remonter un contenu à l'équipe du hub GW2RP Nexus, ce qui se passe ensuite, et sous quel délai.",
  path: "/signaler",
});

export default function ReportInfoPage() {
  return (
    <div className="mx-auto max-w-[840px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <PageHeader
        eyebrow="MODÉRATION"
        title="Signaler un contenu"
        subtitle="Le drapeau se trouve sur le contenu lui-même : une rumeur, une fiche de personnage, un lieu, une annonce."
      />

      <section className="mb-8">
        <SectionHeading title="Où se trouve le drapeau" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          Partout où un contenu appartient à quelqu'un d'autre, un drapeau discret l'accompagne.
          Sur votre propre contenu, il est remplacé par « Modifier » : on ne se signale pas
          soi-même. Signaler demande un compte.
        </p>
      </section>

      <section className="mb-8">
        <SectionHeading title="Les motifs" as="h2" />
        <ul className="flex flex-col">
          {REPORT_REASONS.map((reason) => (
            <li key={reason} className="border-b border-hairline py-3 last:border-b-0">
              <span className="font-display text-[18px] font-semibold tracking-[1px]">
                {REPORT_REASON_LABELS[reason]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <SectionHeading title="Ce qui se passe ensuite" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          L'équipe reçoit le motif, votre commentaire et un extrait du contenu figé au moment
          du signalement. Elle regarde les signalements sous 24 heures. Plusieurs signalements
          visant le même contenu sont traités ensemble : l'équipe ne tranche qu'une fois.
          L'auteur n'apprend pas qui l'a signalé.
        </p>
      </section>

      <section>
        <SectionHeading title="Pour le reste" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          Un problème qui ne vise pas un contenu précis — un différend entre joueurs, une
          question sur les{" "}
          <Link href="/regles" className="text-crimson-ink underline underline-offset-4">
            règles
          </Link>{" "}
          — se règle avec l'équipe directement. Le drapeau ne sert qu'à remonter un contenu.
        </p>
      </section>
    </div>
  );
}
