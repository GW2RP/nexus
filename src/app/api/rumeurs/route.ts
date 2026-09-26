import { NextResponse } from "next/server";

import { REGIONS, type Region } from "@/lib/domain";
import { zoneAt } from "@/lib/weather/grid";
import { formeRumeur, lireLimite, lireNombre } from "@/server/api-overlay";
import { listRumors } from "@/server/queries/rumors";
import { listTerrainZones } from "@/server/queries/weather";

export const dynamic = "force-dynamic";

const LIMITE_PAR_DEFAUT = 5;
const LIMITE_MAXIMALE = 25;

/**
 * Les dernières rumeurs d'une région, pour l'application bureau. Le tableau
 * des rumeurs est public ; ceci en est un extrait, les plus récentes d'abord,
 * sans l'état du lecteur.
 *
 * La région se nomme (`?region=kryte`) ou se déduit d'un point de la carte
 * (`?x=…&y=…`) par la **même règle que la météo** : la zone de terrain qui
 * couvre le point, la dernière de la liste l'emportant. Un point hors de toute
 * région n'a pas de rumeurs à lui, et la réponse le dit (`region: null`)
 * plutôt que de montrer la Tyrie entière.
 *
 * Une région inconnue — ou nommée vide, `?region=` — vaut une erreur, pas
 * « toutes » : une faute de frappe qui ferait taire le filtre en silence
 * montrerait tout à qui croyait lire la Kryte.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);

  let region: Region | null | undefined;
  const nommee = searchParams.get("region")?.trim();
  const x = lireNombre(searchParams, "x");
  const y = lireNombre(searchParams, "y");

  if (nommee !== undefined) {
    region = REGIONS.find((candidate) => candidate === nommee) ?? null;
    if (region === null) {
      return NextResponse.json({ erreur: "Région inconnue." }, { status: 400 });
    }
  } else if (x !== null && y !== null) {
    region = zoneAt(x, y, await listTerrainZones())?.region ?? null;
    if (region === null) return NextResponse.json({ region: null, rumeurs: [] });
  }

  const { items } = await listRumors({ region: region ?? undefined, pageSize: limite });
  return NextResponse.json({ region: region ?? null, rumeurs: items.map(formeRumeur) });
}
