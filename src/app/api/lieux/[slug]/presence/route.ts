import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { canContribute } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { placePresenceSchema } from "@/server/actions/schemas";
import { declarerPresence, PresenceRefusee } from "@/server/place-presence";

export const dynamic = "force-dynamic";

/**
 * « Je suis à ce lieu », depuis l'application bureau, derrière le jeton
 * `Authorization: Bearer` : elle le propose quand le personnage passe à côté,
 * et le renouvelle tant qu'il y reste. La déclaration vit un quart d'heure.
 *
 * Corps : `{ personnage: string, renouveler?: boolean }`, le nom en jeu.
 * Réponse : la présence écrite, échéance comprise. Un renouvellement d'une
 * présence quittée ou déplacée entre-temps répond 409.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ erreur: "Connexion requise." }, { status: 401 });
  if (!canContribute(user)) {
    return NextResponse.json({ erreur: "Votre compte est suspendu." }, { status: 403 });
  }

  const corps: unknown = await request.json().catch(() => null);
  const demande = placePresenceSchema.safeParse(corps);
  if (!demande.success) {
    return NextResponse.json(
      { erreur: demande.error.issues[0]?.message ?? "Présence illisible." },
      { status: 400 },
    );
  }

  const { slug } = await params;
  try {
    const presence = await declarerPresence(
      user,
      { slug },
      {
        characterName: demande.data.personnage,
        source: demande.data.source,
        renouveler: demande.data.renouveler,
      },
    );
    revalidatePath(`/lieux/${slug}`);
    return NextResponse.json({ presence }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (erreur) {
    if (erreur instanceof PresenceRefusee) {
      return NextResponse.json({ erreur: erreur.message }, { status: erreur.statut });
    }
    throw erreur;
  }
}
