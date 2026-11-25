import type { BoardContent, BoardOwner } from "@/lib/boards";

/** Ce que l'activité Discord échange avec le hub. Partagé entre les routes
 *  (`src/app/api/discord`) et l'écran de l'activité, qui ne lit pas `src/server`. */

export const BOARD_OWNER_LABELS: Record<BoardOwner, string> = { groupe: "Groupe", lieu: "Lieu" };

/** Le panneau d'une activité, tel qu'un participant le voit. */
export type ActivityBoard = {
  id: string;
  name: string;
  ownerType: BoardOwner;
  /** Le groupe ou le lieu qui le porte. */
  ownerName: string;
  /** Son adresse sur le hub. */
  path: string;
  revision: number;
  content: BoardContent;
  canWrite: boolean;
  canModerate: boolean;
  canReport: boolean;
};

export type PickableBoard = { id: string; name: string; ownerType: BoardOwner; ownerName: string };
