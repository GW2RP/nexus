import Link from "next/link";

import { BoardEditor } from "@/components/board/board-editor";
import { LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <div className="flex flex-col lg:h-[calc(100dvh-82px)] lg:min-h-[640px]">
      <header className="border-b-2 border-rule bg-surface px-gutter-mobile pt-4 lg:px-gutter-app">
        <Breadcrumb items={crumbs} />
        <div className="-mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="font-display text-[22px] font-semibold leading-[1.2] sm:text-[27px]">
              {board.name}
            </h1>
            <Badge variant={visibility === "public" ? "outline" : "default"}>
              {visibility === "membres" ? <LockIcon size={12} /> : null}
              {visibility === "membres" ? "MEMBRES" : "PUBLIC"}
            </Badge>
          </div>
          <div className="flex flex-wrap items-end gap-4">
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
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </div>
      </header>

      <div className="lg:min-h-0 lg:flex-1">
        <BoardEditor
          boardId={board.id}
          initialContent={{ elements: board.elements, arrows: board.arrows }}
          ownerType={board.ownerType}
          {...editor}
        />
      </div>
    </div>
  );
}
