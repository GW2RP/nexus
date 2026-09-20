import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { TAGS } from "@/server/queries/cache";
import { advanceWeather } from "@/server/weather/simulation";

/** Le rattrapage peut enchaîner plusieurs pas : la valeur par défaut est courte. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Fait avancer la simulation.
 *
 * Vercel appelle cette route toutes les heures en envoyant
 * `Authorization: Bearer $CRON_SECRET`. Un battement horaire pour des pas de
 * deux heures : la moitié des appels ne trouvent rien à faire et rendent la main
 * aussitôt, mais aucun pas n'attend plus d'une heure.
 *
 * Les horaires du `vercel.json` sont en UTC — Vercel ne connaît pas les fuseaux.
 * Ça n'a aucune importance : la route ne regarde pas son heure de déclenchement,
 * elle lit l'horloge du serveur de jeu et rattrape les pas dus.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = env.cronSecret;
  // Sans secret configuré, on refuse : une route qui fait avancer le monde ne
  // s'ouvre pas parce qu'une variable manque.
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ erreur: "Appel refusé." }, { status: 401 });
  }

  let produced: number[];
  try {
    const result = await advanceWeather();
    produced = result.produced;
  } catch (error) {
    console.error("La simulation météo n'a pas avancé :", error);
    return NextResponse.json({ erreur: "La simulation n'a pas avancé." }, { status: 500 });
  }

  if (produced.length > 0) {
    // `revalidateTag` et non `updateTag` : celui-ci n'existe que dans une action
    // serveur, et ceci est une route. `expire: 0` refuse de servir du périmé —
    // le premier visiteur après un pas doit voir le pas qui vient d'être écrit,
    // pas le précédent. Il n'y a qu'un avancement par heure pour le payer.
    revalidateTag(TAGS.weather, { expire: 0 });
    revalidatePath("/meteo");
    revalidatePath("/carte");
    revalidatePath("/");
  }

  return NextResponse.json({
    message:
      produced.length === 0
        ? "Aucun pas à produire."
        : `${produced.length} pas produit${produced.length > 1 ? "s" : ""}.`,
    pas: produced,
  });
}
