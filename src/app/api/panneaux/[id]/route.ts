import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { pullBoard } from "@/server/board-sync";
import { activityReadGrant } from "@/server/discord/activity";

export const dynamic = "force-dynamic";

/**
 * Où en est un panneau : sa révision, et son contenu quand elle a changé
 * depuis `?depuis=`. C'est ce que l'éditeur relit pour suivre les gestes des
 * autres. Lu avec la session — cookie du site, ou jeton de l'activité
 * Discord —, donc jamais mis en cache : une aide de jeu privée n'arrive qu'à
 * son auteur.
 *
 * Dans l'activité, l'en-tête `x-activite` porte le laissez-passer de
 * l'instance : le panneau qu'elle montre se lit sans compte.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const raw = new URL(request.url).searchParams.get("depuis");
  const depuis = raw !== null && /^\d+$/.test(raw) ? Number(raw) : null;

  const user = await getCurrentUser();
  const grant = await activityReadGrant(request.headers.get("x-activite"));
  const pulled = await pullBoard(id, depuis, user, grant);
  if (!pulled) {
    return NextResponse.json({ erreur: "Ce panneau n'existe plus." }, { status: 404 });
  }
  return NextResponse.json(pulled, { headers: { "Cache-Control": "private, no-store" } });
}
