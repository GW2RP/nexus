import { NextResponse } from "next/server";

import { ActivityError, activityConfigured, isInInstance, readPass, signPass } from "@/server/discord/activity";

export const dynamic = "force-dynamic";

/**
 * Renouvelle le laissez-passer de l'activité avant qu'il n'expire. Discord
 * confirme de nouveau que le compte est dans l'instance : qui a quitté le
 * salon n'en reçoit pas d'autre, et cesse de lire son panneau.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!activityConfigured()) {
    return NextResponse.json({ erreur: "L'activité Discord n'est pas configurée." }, { status: 503 });
  }
  const pass = readPass(request.headers.get("x-activite"));
  if (!pass) return NextResponse.json({ erreur: "Rejoignez l'activité depuis Discord." }, { status: 401 });
  try {
    if (!(await isInInstance(pass.instanceId, pass.discordId))) {
      return NextResponse.json({ erreur: "Vous n'êtes plus dans cette activité." }, { status: 403 });
    }
  } catch (error) {
    if (error instanceof ActivityError) {
      return NextResponse.json({ erreur: error.message }, { status: error.status });
    }
    throw error;
  }
  return NextResponse.json(
    { laissezPasser: signPass(pass.instanceId, pass.discordId) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
