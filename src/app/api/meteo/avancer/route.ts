import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { advanceWeather } from "@/server/weather/simulation";

/** Le rattrapage peut enchaîner plusieurs pas : la valeur par défaut est courte. */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Fait avancer la simulation.
 *
 * Vercel appelle cette route quatre fois par jour en envoyant
 * `Authorization: Bearer $CRON_SECRET`. Les horaires du `vercel.json` sont en
 * UTC — Vercel ne connaît pas les fuseaux — et dérivent donc d'une heure au
 * passage à l'heure d'été. Ça n'a aucune importance : la route ne regarde pas
 * son heure de déclenchement, elle lit l'horloge du serveur de jeu et rattrape
 * les pas dus. Un appel trop tôt ne fait rien, un appel en retard rattrape.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
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
