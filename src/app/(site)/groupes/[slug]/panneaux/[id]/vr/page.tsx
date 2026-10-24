import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadGroupBoard } from "@/app/(site)/groupes/[slug]/panneaux/[id]/load";
import { BoardVrScreen } from "@/components/board/board-vr-screen";
import { vrPathOf } from "@/lib/board-vr";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string; id: string }> };

/** Le même accès que le panneau : un panneau réservé aux membres ne s'explore
 *  pas plus qu'il ne se lit. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const loaded = await loadGroupBoard(slug, id);
  return buildMetadata({
    title: loaded ? `${loaded.board.name} en VR · ${loaded.group.name}` : "Panneau introuvable",
    description: loaded
      ? `Le panneau d'affichage « ${loaded.board.name} » en tableau de détective, à explorer en VR.`
      : "Ce panneau n'est pas ouvert.",
    path: loaded ? vrPathOf(loaded.board.path) : `/groupes/${slug}/panneaux/${id}/vr`,
    // Une vue d'un panneau, pas un contenu de plus : le panneau s'indexe, pas elle.
    noIndex: true,
  });
}

export default async function GroupBoardVrPage({ params }: Props) {
  const { slug, id } = await params;
  const loaded = await loadGroupBoard(slug, id);
  if (!loaded) notFound();
  const { group, board } = loaded;
  return (
    <BoardVrScreen
      crumbs={[
        { label: "Groupes", href: "/groupes" },
        { label: group.name, href: `/groupes/${group.slug}` },
      ]}
      board={board}
    />
  );
}
