import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/session";
import { listManagedPlaces } from "@/server/queries/places";

export const dynamic = "force-dynamic";

/**
 * Les lieux que le compte connecté tient — comme auteur ou co-gérant —, avec
 * leur statut. L'application bureau y lit sous quels lieux de « À proximité »
 * poser l'interrupteur : les alentours sont publics et resservis par le CDN,
 * ils ne peuvent pas dire qui les lit.
 *
 * Lecture d'accès : jamais mémorisée, jamais resservie, et 401 sans session.
 * L'administration modifie tous les lieux sur le site, mais n'en tient aucun :
 * elle n'a pas d'interrupteur sous chaque lieu du jeu.
 */
export async function GET(): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  return NextResponse.json(
    { lieux: await listManagedPlaces(user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
