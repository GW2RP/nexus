import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { listPickableBoards } from "@/server/discord/board";

export const dynamic = "force-dynamic";

/** Les panneaux que le compte connecté peut poser sur l'activité : ceux de
 *  ses groupes et de ses lieux. Lecture d'accès, jamais mise en cache. */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  return NextResponse.json(
    { panneaux: await listPickableBoards(user) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
