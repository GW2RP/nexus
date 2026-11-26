import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { quitterPresence } from "@/server/place-presence";

export const dynamic = "force-dynamic";

/** Quitter le lieu où l'on s'était déclaré, depuis l'application bureau. Ne
 *  rien quitter n'est pas une erreur. Un compte suspendu peut toujours partir.
 *
 *  Corps facultatif : `{ lieu: slug }` ne quitte que la présence de
 *  l'overlay à ce lieu — c'est le départ qu'il fait seul, quand on s'éloigne,
 *  et il ne doit pas emporter une déclaration faite ailleurs depuis le site. */
export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const corps: unknown = await request.json().catch(() => null);
  const lieu =
    corps && typeof corps === "object" && typeof (corps as { lieu?: unknown }).lieu === "string"
      ? (corps as { lieu: string }).lieu
      : null;
  const slug = await quitterPresence(user, lieu ? { slug: lieu, source: "overlay" } : undefined);
  if (slug) revalidatePath(`/lieux/${slug}`);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
