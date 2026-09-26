import { NextResponse } from "next/server";

import { formeLieu } from "@/server/api-overlay";
import { getPlaceBySlug } from "@/server/queries/places";

export const dynamic = "force-dynamic";

/**
 * La fiche d'un lieu, pour l'application bureau : ce que `/lieux/[slug]`
 * montre à un visiteur, sans la page autour. Publique comme la fiche ; un lieu
 * masqué est introuvable ici comme là-bas.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const lieu = await getPlaceBySlug(slug);
  if (!lieu) {
    return NextResponse.json({ erreur: "Lieu introuvable." }, { status: 404 });
  }
  return NextResponse.json(formeLieu(lieu));
}
