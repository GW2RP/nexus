import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { listCharactersOf } from "@/server/queries/characters";

export const dynamic = "force-dynamic";

/**
 * Les personnages du compte connecté, champ par champ : l'application bureau
 * y retrouve la fiche du personnage joué, par son nom, pour la présence
 * Discord. Lecture d'accès : jamais mise en cache, et 401 sans session.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  const personnages = (await listCharactersOf(user.id)).map((personnage) => ({
    id: personnage.id,
    slug: personnage.slug,
    name: personnage.name,
  }));
  return NextResponse.json({ personnages }, { headers: { "Cache-Control": "private, no-store" } });
}
