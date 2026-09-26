import { NextResponse } from "next/server";

import { CONTINENT_HEIGHT, CONTINENT_WIDTH } from "@/lib/map";
import { listPlacesForMap } from "@/server/queries/places";

export const dynamic = "force-dynamic";

/** Le rayon de recherche par défaut, en pixels de continent. Une carte du jeu
 *  fait trois à quatre mille pixels de large : ce rayon couvre la carte où l'on
 *  se tient et déborde un peu sur les voisines. */
const RAYON_PAR_DEFAUT = 2_500;
/** Au-delà, la liste dirait « tout le continent » — ce n'est plus la proximité. */
const RAYON_MAXIMAL = 10_000;
const LIMITE_PAR_DEFAUT = 8;
const LIMITE_MAXIMALE = 25;

/**
 * Les lieux du registre autour d'un point de la carte, du plus proche au plus
 * éloigné.
 *
 * Une lecture publique, comme le relevé de météo : le registre des lieux l'est
 * déjà, et cette route n'en montre rien de plus — seulement l'ordre des
 * distances. Elle existe pour l'application bureau, qui connaît la position du
 * personnage joué et ne peut pas faire descendre tout le registre pour trier
 * elle-même.
 *
 * La distance est celle du plan, en pixels de continent, entre le point demandé
 * et le pin du lieu. Un lieu sans coordonnées n'a pas de distance : il n'est pas
 * proche, il n'est nulle part sur la carte, et il ne figure pas ici.
 *
 * Les coordonnées sont bornées au continent plutôt que refusées, comme pour le
 * relevé : un personnage au bord d'une carte tombe parfois d'un pixel dehors.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  // `Number(null)` et `Number("")` valent zéro : sans ce garde-fou, une requête
  // sans coordonnées listerait en silence les lieux voisins du coin nord-ouest.
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

  const point = {
    x: Math.min(Math.max(Math.round(x), 0), CONTINENT_WIDTH - 1),
    y: Math.min(Math.max(Math.round(y), 0), CONTINENT_HEIGHT - 1),
  };
  const rayon = Math.min(Math.max(lire("rayon") ?? RAYON_PAR_DEFAUT, 1), RAYON_MAXIMAL);
  const limite = Math.min(
    Math.max(Math.round(lire("limite") ?? LIMITE_PAR_DEFAUT), 1),
    LIMITE_MAXIMALE,
  );

  const lieux = (await listPlacesForMap())
    .flatMap((lieu) => {
      if (!lieu.coordinates) return [];
      const distance = Math.hypot(lieu.coordinates.x - point.x, lieu.coordinates.y - point.y);
      return distance <= rayon ? [{ ...lieu, distance: Math.round(distance) }] : [];
    })
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name, "fr"))
    .slice(0, limite);

  return NextResponse.json({ ...point, rayon, lieux });
}
