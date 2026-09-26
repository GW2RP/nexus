import { NextResponse } from "next/server";

import { formeEvenement, lireLimite } from "@/server/api-overlay";
import { listEvents } from "@/server/queries/events";
import { getPlaceBySlug } from "@/server/queries/places";

export const dynamic = "force-dynamic";

const LIMITE_PAR_DEFAUT = 12;
const LIMITE_MAXIMALE = 50;

/**
 * Les scènes qui se tiennent dans un lieu et ne sont pas finies, pour
 * l'application bureau.
 *
 * Sans lecteur : seules les scènes **publiques** sortent, comme sur la fiche
 * du lieu lue sans compte. Une scène privée ne sort jamais d'une route
 * publique, c'est la règle de l'agenda.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const lieu = await getPlaceBySlug(slug);
  if (!lieu) {
    return NextResponse.json({ erreur: "Lieu introuvable." }, { status: 404 });
  }

  const evenements = await listEvents({
    placeId: lieu.id,
    viewer: null,
    limit: lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE),
  });

  return NextResponse.json({ lieu: lieu.slug, evenements: evenements.map(formeEvenement) });
}
