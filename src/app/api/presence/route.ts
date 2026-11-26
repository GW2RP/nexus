import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { presenceDe } from "@/server/place-presence";

export const dynamic = "force-dynamic";

/**
 * La présence du compte connecté — le lieu où il s'est déclaré, d'où qu'il
 * l'ait fait —, ou `null`. L'application bureau la relit pour suivre une
 * déclaration faite ou quittée sur le site.
 *
 * Lecture d'accès : jamais mise en cache, et 401 sans session.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  return NextResponse.json(
    { presence: await presenceDe(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
