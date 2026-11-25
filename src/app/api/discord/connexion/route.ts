import { NextResponse } from "next/server";
import { z } from "zod";

import {
  ActivityError,
  activityConfigured,
  exchangeDiscordCode,
  isInInstance,
  openLinkedSession,
  readDiscordUser,
  signPass,
} from "@/server/discord/activity";

export const dynamic = "force-dynamic";

const demandeSchema = z.object({
  code: z.string().min(1).max(200),
  instanceId: z.string().min(1).max(100),
});

/**
 * L'entrée dans l'activité Discord. Le SDK a donné un code ; le serveur
 * l'échange, vérifie auprès de Discord que ce compte est bien dans l'instance,
 * et rend :
 *
 * - `accessToken`, que le SDK reprend pour s'authentifier auprès de Discord ;
 * - `laissezPasser`, qui ouvre en lecture le panneau de l'instance ;
 * - `session`, si le compte Discord est lié à un compte du hub : un jeton que
 *   l'activité représente en `Authorization: Bearer`, et le compte. Sans
 *   lien, `null` : on regarde, on n'écrit pas.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!activityConfigured()) {
    return NextResponse.json({ erreur: "L'activité Discord n'est pas configurée." }, { status: 503 });
  }
  const demande = demandeSchema.safeParse(await request.json().catch(() => null));
  if (!demande.success) return NextResponse.json({ erreur: "Demande illisible." }, { status: 400 });
  const { code, instanceId } = demande.data;

  try {
    const accessToken = await exchangeDiscordCode(code);
    const discord = await readDiscordUser(accessToken);
    if (!(await isInInstance(instanceId, discord.id))) {
      return NextResponse.json({ erreur: "Vous n'êtes pas dans cette activité." }, { status: 403 });
    }
    return NextResponse.json(
      {
        accessToken,
        laissezPasser: signPass(instanceId, discord.id),
        discord: { id: discord.id, nom: discord.globalName ?? discord.username },
        session: await openLinkedSession(discord.id),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof ActivityError) {
      return NextResponse.json({ erreur: error.message }, { status: error.status });
    }
    console.error("Connexion à l'activité Discord :", error);
    return NextResponse.json({ erreur: "La connexion a échoué." }, { status: 500 });
  }
}
