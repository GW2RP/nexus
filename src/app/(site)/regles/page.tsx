import type { Metadata } from "next";

import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Règles du hub",
  description:
    "Ce qui se fait et ce qui ne se fait pas sur GW2RP Nexus : le contenu appartient à son auteur, une rumeur vise un personnage et jamais un joueur, et toute modération est motivée.",
  path: "/regles",
  keywords: ["règles RP Guild Wars 2", "charte communauté GW2RP"],
});

const RULES = [
  {
    title: "Le contenu appartient à quelqu'un",
    body: "Chaque fiche, rumeur, lieu et évènement a un auteur. Vous modifiez et supprimez le vôtre ; celui des autres se signale, il ne se corrige pas.",
  },
  {
    title: "Une rumeur vise un personnage, jamais un joueur",
    body: "Une rumeur est dite par un personnage : elle peut être fausse, c'est le but. Viser la personne derrière l'écran, c'est le drapeau — l'équipe regarde sous 24 heures.",
  },
  {
    title: "Rien d'inventé",
    body: "Une donnée absente s'affiche en placeholder explicite. On n'écrit pas de faux chiffre d'inscrits, pas de faux compte rendu, pas de fausse citation.",
  },
  {
    title: "Le hub reste dans l'univers",
    body: "Les fiches, les lieux et les annonces se lisent depuis la Tyrie. Ce qui relève de l'organisation hors univers se met dans la section « ce qu'il faut savoir » d'un évènement.",
  },
  {
    title: "Les images ont une alternative textuelle",
    body: "Toute bannière, tout portrait, tout plan téléversé porte une description. Ce n'est pas une option : c'est ce qui rend le hub lisible à tout le monde.",
  },
  {
    title: "La modération est motivée",
    body: "Toute décision — suppression, avertissement, suspension — est inscrite au journal avec son auteur, sa date et son motif. Une suppression demande toujours une confirmation explicite.",
  },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-[840px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="GW2RP NEXUS"
        title="Règles du hub"
        subtitle="Six règles, et le bon sens pour le reste. Elles valent pour tout le monde, l'équipe comprise."
      />

      {RULES.map((rule) => (
        <section key={rule.title} className="mb-8">
          <SectionHeading title={rule.title} as="h2" />
          <p className="max-w-[70ch] body text-ink-body">{rule.body}</p>
        </section>
      ))}

      <section className="mb-8">
        <SectionHeading title="Les rôles" as="h2" />
        <dl className="flex flex-col">
          {[
            ["Visiteur", "Lit tout le contenu public. Ne signale pas, ne s'inscrit pas."],
            [
              "Membre",
              "Crée et modifie ses personnages, lieux, évènements et rumeurs ; s'inscrit et se désinscrit ; signale.",
            ],
            ["Conteur", "En plus : pose la météo d'une région et épingle un évènement sur la carte."],
            [
              "Administration",
              "En plus : tient la file des signalements, supprime, avertit, suspend.",
            ],
          ].map(([role, rights]) => (
            <div key={role} className="border-b border-hairline py-4 last:border-b-0">
              <dt className="font-display text-[18px] font-semibold tracking-[1px]">{role}</dt>
              <dd className="mt-1 text-[18px] leading-[1.55] text-ink-body">{rights}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
