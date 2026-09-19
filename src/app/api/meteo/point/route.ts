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
  const x = Number(searchParams.get("x"));
  const y = Number(searchParams.get("y"));

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
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
