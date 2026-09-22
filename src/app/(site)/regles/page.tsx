import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { SectionHeading } from "@/components/ui/section-heading";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Règlement d'usage",
  description:
    "Ce qui se publie et ce qui ne se publie pas sur GW2RP Nexus : rien d'illégal, rien de réservé aux adultes, rien qui vise le joueur derrière le personnage.",
  path: "/regles",
  keywords: ["règlement GW2RP", "charte communauté roleplay Guild Wars 2"],
});

const RULES = [
  {
    title: "Rien d'illégal",
    body: "La loi française s'applique ici comme ailleurs. Apologie du terrorisme ou des crimes contre l'humanité, incitation à la haine, contenu pédopornographique, menaces, contrefaçon, liens de piratage : suppression immédiate, compte fermé, et signalement aux autorités quand c'est ce que la loi demande.",
  },
  {
    title: "Le hub reste visitable",
    body: "Il se lit au travail, en cours, dans le train, avec quelqu'un par-dessus l'épaule. Donc pas de contenu pour adultes : ni nudité, ni scène sexuelle écrite ou dessinée, ni violence complaisante, ni gore. Un personnage peut avoir un passé sombre sans que sa fiche le raconte en entier ; ce qui se joue à huis clos reste à huis clos.",
  },
  {
    title: "Le joueur n'est pas le personnage",
    body: "Une rumeur, une inimitié, une trahison visent un personnage : c'est le jeu. Viser la personne derrière l'écran — insultes, harcèlement, propos racistes, sexistes ou LGBT-phobes, moqueries répétées — n'en est pas. Un différend entre joueurs se règle hors du hub, pas en publiant à son sujet.",
  },
  {
    title: "Ce qui est réel reste privé",
    body: "Pas de nom, d'adresse, de photo, de compte personnel ni de capture de conversation privée — ni les vôtres, ni surtout ceux d'un autre. Le hub n'a besoin que d'un pseudonyme.",
  },
  {
    title: "Vous publiez ce qui est à vous",
    body: "Un texte que vous avez écrit, une image que vous avez le droit d'utiliser. Une illustration trouvée en ligne appartient à quelqu'un : sans son accord, elle ne se téléverse pas. Chaque fiche, lieu, scène et rumeur a un auteur : vous modifiez et supprimez le vôtre, celui des autres se signale.",
  },
  {
    title: "Les images portent leur alternative",
    body: "Toute bannière, tout portrait, tout plan téléversé est décrit en texte. Le champ est obligatoire avant le fichier : une image sans alternative ne dit rien à qui ne la voit pas.",
  },
  {
    title: "Le hub s'écrit depuis la Tyrie",
    body: "Les fiches, les lieux et les annonces se lisent en univers. Ce qui relève de l'organisation — canal vocal, horaire réel, niveau conseillé — se met dans la section « ce qu'il faut savoir » d'une scène.",
  },
  {
    title: "Rien d'inventé, rien de répété",
    body: "Pas de faux compte rendu, pas de fausse citation, pas de faux chiffre. Une donnée absente s'affiche en placeholder, elle ne se remplit pas au jugé. Et pas de publicité, de démarchage, de vente de services de jeu ni de même annonce republiée pour remonter dans la liste.",
  },
  {
    title: "Un compte, une personne",
    body: "Vous répondez de ce qui est publié sous le vôtre. Un compte suspendu ne se contourne pas en en ouvrant un autre.",
  },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-[840px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        eyebrow="GW2RP NEXUS"
        title="Règlement d'usage"
        subtitle="Il vaut pour tout le monde, l'équipe comprise, et pour tout ce qui se publie ici : fiches, lieux, scènes, rumeurs, images."
      />

      {RULES.map((rule) => (
        <section key={rule.title} className="mb-8">
          <SectionHeading title={rule.title} as="h2" />
          <p className="max-w-[70ch] body text-ink-body">{rule.body}</p>
        </section>
      ))}

      <section>
        <SectionHeading title="Ce qui se passe quand une règle saute" as="h2" />
        <p className="max-w-[70ch] body text-ink-body">
          Suppression du contenu, avertissement, suspension du compte, selon ce qui s'est
          passé. Toute décision est inscrite au journal de modération avec son auteur, sa date
          et son motif. Un contenu qui vous paraît sortir du règlement se remonte par son
          drapeau ; la page{" "}
          <Link href="/signaler" className="text-crimson-ink underline underline-offset-4">
            signaler un contenu
          </Link>{" "}
          dit la suite.
        </p>
      </section>
    </div>
  );
}
