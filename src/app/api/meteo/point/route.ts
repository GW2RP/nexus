import { NextResponse } from "next/server";

import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import { getWeatherProbe } from "@/server/queries/weather";

export const dynamic = "force-dynamic";

/**
 * Le temps en un point de la carte.
 *
 * Une lecture, publique comme la météo elle-même : pas de secret, pas de rôle.
 * Elle existe parce que la grille entière ne peut pas voyager jusqu'au
 * navigateur — 8 960 cellules et dix grandeurs — alors qu'un relevé tient en
 * quelques nombres.
 *
 * Les coordonnées sont bornées au continent plutôt que refusées : un clic au
 * bord de la carte tombe parfois d'un pixel dehors, et ce n'est pas une erreur.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  // `Number(null)` et `Number("")` valent zéro : sans ce garde-fou, une requête
  // sans coordonnées sonderait le coin nord-ouest du continent en silence et
  // rendrait un relevé parfaitement crédible pour un point que personne n'a
  // demandé.
  const lire = (nom: string): number | null => {
    const brut = searchParams.get(nom);
    if (brut === null || brut.trim() === "") return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) ? valeur : null;
  };

  const x = lire("x");
  const y = lire("y");

  if (x === null || y === null) {
    return NextResponse.json({ erreur: "Coordonnées illisibles." }, { status: 400 });
  }

  const releve = await getWeatherProbe(
    Math.min(Math.max(Math.round(x), 0), CONTINENT_WIDTH - 1),
    Math.min(Math.max(Math.round(y), 0), CONTINENT_HEIGHT - 1),
  );

  if (!releve) {
    return NextResponse.json({ erreur: "Aucun pas de simulation en base." }, { status: 404 });
  }

  return NextResponse.json(releve);
}
