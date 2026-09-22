import Link from "next/link";

import { BoardPreview } from "@/components/board/board-preview";
import { LockIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { formatLongDate } from "@/lib/dates";
import type { BoardSummary } from "@/server/types";

/** Un panneau dans la liste de son groupe : son aperçu, son nom, qui le lit. */
export function BoardCard({ board }: { board: BoardSummary }) {
  return (
    <Link href={board.path} className="group flex flex-col gap-3">
      <div className="border border-rule bg-surface p-1.5">
        <BoardPreview content={{ elements: board.elements, arrows: board.arrows }} height={188} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="card-title text-ink group-hover:text-crimson-ink">{board.name}</span>
        <Badge variant={board.visibility === "public" ? "outline" : "default"}>
          {board.visibility === "membres" ? <LockIcon size={12} /> : null}
          {board.visibility === "membres" ? "MEMBRES" : "PUBLIC"}
        </Badge>
      </div>
      <span className="meta text-ink-muted">
        {board.elementCount > 0
          ? `${board.elementCount} élément${board.elementCount > 1 ? "s" : ""} · modifié le ${formatLongDate(new Date(board.updatedAt))}`
          : `Ouvert le ${formatLongDate(new Date(board.createdAt))}`}
      </span>
    </Link>
  );
}
