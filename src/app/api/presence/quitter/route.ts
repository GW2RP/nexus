import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { quitterPresence } from "@/server/place-presence";

export const dynamic = "force-dynamic";

/** Quitter le lieu où l'on s'était déclaré, depuis l'application bureau. Ne
 *  rien quitter n'est pas une erreur. Un compte suspendu peut toujours partir. */
export async function POST(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const slug = await quitterPresence(user);
  if (slug) revalidatePath(`/lieux/${slug}`);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
