import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { canContribute } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";
import { placeActivitySchema } from "@/server/actions/schemas";
import { ActiviteRefusee, ecrireActivite } from "@/server/place-activity";
import { TAGS } from "@/server/queries/cache";

export const dynamic = "force-dynamic";

/**
 * Le statut d'un lieu, basculé depuis l'application bureau : la même écriture
 * que l'interrupteur de la fiche (`ecrireActivite`), derrière la session du
 * jeton `Authorization: Bearer`. C'est la seule route de l'overlay qui écrive,
 * et elle ne sert qu'à l'équipe du lieu.
 *
 * Corps : `{ active: boolean, message?: string }`. Réponse : le statut écrit.
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
  const demande = placeActivitySchema.safeParse(corps);
  if (!demande.success) {
    return NextResponse.json(
      { erreur: demande.error.issues[0]?.message ?? "Statut illisible." },
      { status: 400 },
    );
  }

  const { slug } = await params;
  try {
    const { activity } = await ecrireActivite(user, { slug }, demande.data);
    // `revalidateTag` et non `updateTag`, qui n'existe que dans une action.
    // `expire: 0` : la fiche doit dire ce que l'équipe vient de décider.
    revalidateTag(TAGS.places, { expire: 0 });
    revalidatePath(`/lieux/${slug}`);
    revalidatePath("/lieux");
    revalidatePath("/carte");
    return NextResponse.json({ activity });
  } catch (erreur) {
    if (erreur instanceof ActiviteRefusee) {
      return NextResponse.json({ erreur: erreur.message }, { status: erreur.statut });
    }
    throw erreur;
  }
}
