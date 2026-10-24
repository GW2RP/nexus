import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadGroupBoard } from "@/app/(site)/groupes/[slug]/panneaux/[id]/load";
import { BoardSettingsDialog } from "@/components/board/board-dialogs";
import { BoardScreen } from "@/components/board/board-screen";
import { DeleteContent } from "@/components/content/delete-content";
import { BOARD_VISIBILITY_LABELS } from "@/lib/boards";
import { canContribute, canManageBoard, canWriteBoard } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { deleteBoardAction } from "@/server/actions/boards";
import { listGroupBoardTabs } from "@/server/queries/boards";

type Props = {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ element?: string }>;
};

/** Un panneau se lit différemment selon le compte — un panneau réservé aux
 *  membres n'existe pas pour les autres. Il est rendu à chaque requête. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, id } = await params;
  const loaded = await loadGroupBoard(slug, id);
  if (!loaded) {
    return buildMetadata({
      title: "Panneau introuvable",
      description: "Ce panneau n'est pas ouvert.",
      path: `/groupes/${slug}/panneaux/${id}`,
      noIndex: true,
    });
  }
  return buildMetadata({
    title: `${loaded.board.name} · ${loaded.group.name}`,
    description: `Le panneau d'affichage « ${loaded.board.name} » du groupe ${loaded.group.name}.`,
    path: loaded.board.path,
    // Ce qui est privé ne sort pas : ni le panneau des membres, ni celui d'un
    // groupe privé, fût-il public dans le cercle.
    noIndex: loaded.board.visibility !== "public" || loaded.group.visibility === "prive",
  });
}

export default async function GroupBoardPage({ params, searchParams }: Props) {
  const [{ slug, id }, { element }] = await Promise.all([params, searchParams]);
  const loaded = await loadGroupBoard(slug, id);
  if (!loaded) notFound();
  const { user, group, groupAccess, access, board } = loaded;

  const tabs = await listGroupBoardTabs(groupAccess, user);
  const canWrite = canWriteBoard(user, access);
  const manages = canManageBoard(user, access);

  return (
    <BoardScreen
      crumbs={[
        { label: "Groupes", href: "/groupes" },
        { label: group.name, href: `/groupes/${group.slug}` },
        { label: "Panneaux" },
      ]}
      board={board}
      visibility={board.visibility}
      tabs={tabs}
      actions={
        manages ? (
          <>
            <BoardSettingsDialog boardId={board.id} name={board.name} visibility={board.visibility} />
            <DeleteContent
              id={board.id}
              action={deleteBoardAction}
              title={board.name}
              question="Fermer ce panneau ?"
              consequence="Le panneau disparaît avec tout ce qu'on y a posé : notes, formes et flèches. C'est irréversible."
              verb="FERMER LE PANNEAU"
            />
          </>
        ) : null
      }
      editor={{
        me: user ? { id: user.id, name: user.name } : null,
        canWrite,
        // Entre membres, le panneau est commun : chacun range ce que les
        // autres ont posé.
        canModerate: canWrite,
        canReport: canContribute(user),
        initialElementId: element ?? null,
        facts: [
          { label: "Groupe", value: group.name },
          { label: "Visibilité", value: BOARD_VISIBILITY_LABELS[board.visibility] },
        ],
      }}
    />
  );
}
