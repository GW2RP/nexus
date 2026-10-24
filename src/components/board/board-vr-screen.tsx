import Link from "next/link";

import { BoardFrame } from "@/components/board/board-frame";
import { BoardVr } from "@/components/board/board-vr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BoardSummary } from "@/server/types";

/** L'écran de l'exploration en VR : l'en-tête du panneau, puis la scène, qui
 *  prend la hauteur restante. C'est une lecture — le panneau lui-même reste à
 *  son adresse, et on y revient d'un lien. */
export function BoardVrScreen({
  crumbs,
  board,
}: {
  crumbs: { label: string; href?: string }[];
  board: BoardSummary;
}) {
  return (
    <BoardFrame
      crumbs={[...crumbs, { label: board.name, href: board.path }, { label: "En VR" }]}
      title={board.name}
      badges={<Badge variant="outline">LECTURE SEULE</Badge>}
      actions={
        <Button asChild variant="outline" size="sm">
          <Link href={board.path}>{"Retour au panneau".toLocaleUpperCase("fr-FR")}</Link>
        </Button>
      }
    >
      <BoardVr
        content={{ elements: board.elements, arrows: board.arrows }}
        label={`Le panneau « ${board.name} » en trois dimensions`}
      />
    </BoardFrame>
  );
}
