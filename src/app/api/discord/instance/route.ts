import { NextResponse } from "next/server";
import { z } from "zod";

import { canSeeBoard } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { loadBoard, loadBoardAccess } from "@/server/boards";
import {
  ActivityError,
  activityGrantsBoard,
  activityReadGrant,
  isInInstance,
  readPass,
  setInstanceBoard,
} from "@/server/discord/activity";
import { activityBoardView } from "@/server/discord/board";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Le panneau que montre une instance de l'activité, pour le participant que
 * dit son laissez-passer (`x-activite`). `panneau: null` tant que personne
 * n'en a posé ; avec `?suivi`, seulement son identifiant (`panneauId`). L'activité relit cette adresse pour suivre un changement de
 * panneau ; le contenu, lui, se suit par `/api/panneaux/<id>`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const pass = readPass(request.headers.get("x-activite"));
  if (!pass) return NextResponse.json({ erreur: "Rejoignez l'activité depuis Discord." }, { status: 401 });
  const grant = await activityReadGrant(request.headers.get("x-activite"));
    // Le suivi ne demande que lequel : le contenu se suit par sa propre adresse.
  // Un panneau que son poseur ne lit plus n'est plus celui de l'instance.
  if (new URL(request.url).searchParams.has("suivi")) {
    const head = grant ? await loadBoardAccess(grant.boardId) : null;
    const panneauId =
      grant && head && activityGrantsBoard(grant, grant.boardId, head.access) ? grant.boardId : null;
    return NextResponse.json({ panneauId }, { headers: NO_STORE });
  }
  const viewer = await getCurrentUser();
  const panneau = grant ? await activityBoardView(grant, viewer) : null;
  return NextResponse.json({ panneau }, { headers: NO_STORE });
}

const choixSchema = z.object({ panneau: z.string().regex(/^[a-f0-9]{24}$/) });

/**
 * Poser un panneau sur l'instance — au lancement, ou depuis le menu de
 * l'activité. Il faut une session du hub, et pouvoir lire soi-même le panneau
 * qu'on montre à tout le salon. Discord confirme de nouveau qu'on est dans
 * l'instance : le laissez-passer a pu survivre au départ du salon.
 */
export async function PUT(request: Request): Promise<NextResponse> {
  const pass = readPass(request.headers.get("x-activite"));
  if (!pass) return NextResponse.json({ erreur: "Rejoignez l'activité depuis Discord." }, { status: 401 });
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ erreur: "Liez votre compte Discord au hub pour choisir le panneau." }, { status: 401 });
  }
  const choix = choixSchema.safeParse(await request.json().catch(() => null));
  if (!choix.success) return NextResponse.json({ erreur: "Panneau illisible." }, { status: 400 });

  try {
    const loaded = await loadBoard(choix.data.panneau);
    if (!loaded || !canSeeBoard(user, loaded.access)) {
      return NextResponse.json({ erreur: "Ce panneau n'existe plus." }, { status: 404 });
    }
    if (!(await isInInstance(pass.instanceId, pass.discordId))) {
      return NextResponse.json({ erreur: "Vous n'êtes plus dans cette activité." }, { status: 403 });
    }
    await setInstanceBoard(pass.instanceId, choix.data.panneau, user.id);
    return NextResponse.json(
      { panneau: await activityBoardView({ boardId: choix.data.panneau, setter: user }, user) },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof ActivityError) {
      return NextResponse.json({ erreur: error.message }, { status: error.status });
    }
    throw error;
  }
}
