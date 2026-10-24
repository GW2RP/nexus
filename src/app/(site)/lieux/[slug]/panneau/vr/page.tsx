import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { BoardVrScreen } from "@/components/board/board-vr-screen";
import { vrPathOf } from "@/lib/board-vr";
import { buildMetadata } from "@/lib/seo";
import { getPlaceBoard } from "@/server/queries/boards";
import { getPlaceBySlug } from "@/server/queries/places";

type Props = { params: Promise<{ slug: string }> };

export const dynamic = "force-dynamic";

/** Une lecture par requête, pour les métadonnées comme pour la page. */
const load = cache(async (slug: string) => {
  const place = await getPlaceBySlug(slug);
  const board = place ? await getPlaceBoard(place) : null;
  return place && board ? { place, board: { ...board, name: place.name } } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const loaded = await load(slug);
  return buildMetadata({
    title: loaded ? `Panneau d'affichage en VR · ${loaded.place.name}` : "Panneau introuvable",
    description: loaded
      ? `Le panneau d'affichage de ${loaded.place.name} en tableau de détective, à explorer en VR.`
      : "Ce lieu n'a pas ouvert de panneau d'affichage.",
    path: loaded ? vrPathOf(loaded.board.path) : `/lieux/${slug}/panneau/vr`,
    // Une vue d'un panneau, pas un contenu de plus : le panneau s'indexe, pas elle.
    noIndex: true,
  });
}

export default async function PlaceBoardVrPage({ params }: Props) {
  const { slug } = await params;
  const loaded = await load(slug);
  if (!loaded) notFound();
  const { place, board } = loaded;
  return (
    <BoardVrScreen
      crumbs={[
        { label: "Lieux", href: "/lieux" },
        { label: place.name, href: `/lieux/${place.slug}` },
      ]}
      board={board}
    />
  );
}
