import Link from "next/link";

import { BoardVr } from "@/components/board/board-vr";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <div className="flex flex-col lg:h-[calc(100dvh-82px)] lg:min-h-[640px]">
      <header className="border-b-2 border-rule bg-surface px-gutter-mobile pt-4 lg:px-gutter-app">
        <Breadcrumb items={[...crumbs, { label: board.name, href: board.path }, { label: "En VR" }]} />
        <div className="-mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-[22px] font-semibold leading-[1.2] sm:text-[27px]">
              {board.name}
            </h1>
            <Badge variant="outline">LECTURE SEULE</Badge>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={board.path}>{"Retour au panneau".toLocaleUpperCase("fr-FR")}</Link>
          </Button>
        </div>
      </header>

      <div className="lg:min-h-0 lg:flex-1">
        <BoardVr
          content={{ elements: board.elements, arrows: board.arrows }}
          label={`Le panneau « ${board.name} » en trois dimensions`}
        />
      </div>
    </div>
  );
}
