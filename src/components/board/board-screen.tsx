import Link from "next/link";

import { BoardEditor } from "@/components/board/board-editor";
import { BoardFrame } from "@/components/board/board-frame";
import { BoardVrLink } from "@/components/board/board-vr-link";
import { LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { vrPathOf } from "@/lib/board-vr";
import type { BoardVisibility } from "@/lib/boards";
import { cn } from "@/lib/utils";
import type { BoardSummary } from "@/server/types";

/** L'écran d'un panneau : son en-tête, puis l'éditeur, qui prend la hauteur
 *  restante — comme la carte, c'est une vue plein écran. En dessous de `lg`,
 *  l'éditeur empile le panneau et sa colonne de propriétés. */
export function BoardScreen({
  crumbs,
  board,
  visibility,
  tabs,
  actions,
  editor,
}: {
  crumbs: { label: string; href?: string }[];
  board: BoardSummary;
  visibility: BoardVisibility;
  /** Les autres panneaux du même groupe. */
  tabs?: { id: string; name: string; path: string }[];
  actions?: React.ReactNode;
  editor: Omit<React.ComponentProps<typeof BoardEditor>, "boardId" | "initialContent" | "ownerType">;
}) {
  return (
    <BoardFrame
      crumbs={crumbs}
      title={board.name}
      badges={
        <Badge variant={visibility === "public" ? "outline" : "default"}>
          {visibility === "membres" ? <LockIcon size={12} /> : null}
          {visibility === "membres" ? "MEMBRES" : "PUBLIC"}
        </Badge>
      }
      actions={
        <>
          {tabs && tabs.length > 1 ? (
            <nav aria-label="Panneaux du groupe" className="flex flex-wrap">
              {tabs.map((tab) => {
                const current = tab.id === board.id;
                return (
                  <Link
                    key={tab.id}
                    href={tab.path}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "-mb-[14px] flex min-h-tap items-center border-b-2 px-4 button-label",
                      current
                        ? "border-crimson text-ink"
                        : "border-transparent text-gold-ink hover:bg-surface-selected",
                    )}
                  >
                    {tab.name.toLocaleUpperCase("fr-FR")}
                  </Link>
                );
              })}
            </nav>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {/* Un panneau vide n'a rien à épingler au tableau. */}
            {board.elements.length > 0 ? <BoardVrLink href={vrPathOf(board.path)} /> : null}
            {actions}
          </div>
        </>
      }
    >
      <BoardEditor
        boardId={board.id}
        initialContent={{ elements: board.elements, arrows: board.arrows }}
        ownerType={board.ownerType}
        {...editor}
      />
    </BoardFrame>
  );
}
