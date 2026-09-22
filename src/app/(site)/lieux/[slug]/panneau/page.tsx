import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BoardScreen } from "@/components/board/board-screen";
import { DeleteContent } from "@/components/content/delete-content";
import { REGION_LABELS } from "@/lib/domain";
import { canContribute, canEditPlace, canWriteBoard } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deleteBoardAction } from "@/server/actions/boards";
import { getPlaceBoard } from "@/server/queries/boards";
import { getPlaceBySlug } from "@/server/queries/places";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ element?: string }>;
};

/** Qui peut toucher à quoi dépend du compte : la page est rendue à chaque requête. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const place = await getPlaceBySlug(slug);
  const board = place ? await getPlaceBoard(place) : null;
  if (!place || !board) {
    return buildMetadata({
      title: "Panneau introuvable",
      description: "Ce lieu n'a pas ouvert de panneau d'affichage.",
      path: `/lieux/${slug}/panneau`,
      noIndex: true,
    });
  }
  return buildMetadata({
    title: `Panneau d'affichage · ${place.name}`,
    description: `Les notes épinglées au panneau d'affichage de ${place.name}, en ${REGION_LABELS[place.region]}.`,
    path: board.path,
  });
}

export default async function PlaceBoardPage({ params, searchParams }: Props) {
  const [{ slug }, { element }] = await Promise.all([params, searchParams]);
  const [place, user] = await Promise.all([getPlaceBySlug(slug), getCurrentUser()]);
  if (!place) notFound();
  const board = await getPlaceBoard(place);
  if (!board) notFound();

  const team = { authorId: place.authorId, managerIds: place.managers.map((manager) => manager.id) };
  const access = { ownerType: "lieu" as const, place: team };
  const manages = canEditPlace(user, team);

  return (
    <BoardScreen
      crumbs={[
        { label: "Lieux", href: "/lieux" },
        { label: place.name, href: `/lieux/${place.slug}` },
        { label: "Panneau d'affichage" },
      ]}
      board={{ ...board, name: place.name }}
      visibility="public"
      actions={
        manages ? (
          <DeleteContent
            id={board.id}
            action={deleteBoardAction}
            title={`Le panneau de ${place.name}`}
            question="Fermer ce panneau ?"
            consequence="Le panneau disparaît avec toutes les notes qu'on y a épinglées. La fiche du lieu reste. C'est irréversible."
            verb="FERMER LE PANNEAU"
          />
        ) : null
      }
      editor={{
        me: user ? { id: user.id, name: user.name } : null,
        canWrite: canWriteBoard(user, access),
        // Sur le panneau d'un lieu, chacun ne touche qu'à ce qu'il a posé ;
        // l'équipe du lieu fait le ménage.
        canModerate: manages,
        canReport: canContribute(user),
        initialElementId: element ?? null,
        facts: [
          { label: "Lieu", value: place.name },
          { label: "Visibilité", value: "Public" },
        ],
      }}
    />
  );
}
