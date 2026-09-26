import { NextResponse } from "next/server";

import {
  formeEvenement,
  formeGroupe,
  formeLieuResume,
  formePersonnage,
  lireLimite,
} from "@/server/api-overlay";
import { listCharacters } from "@/server/queries/characters";
import { listEvents } from "@/server/queries/events";
import { listGroups } from "@/server/queries/groups";
import { listPlaces } from "@/server/queries/places";
import { searchRegex } from "@/server/queries/shared";

export const dynamic = "force-dynamic";

const LIMITE_PAR_DEFAUT = 5;
const LIMITE_MAXIMALE = 20;
/** En dessous, une lettre seule ramènerait la moitié du registre. */
const LONGUEUR_MINIMALE = 2;

/**
 * Une recherche à travers les lieux, les personnages, les groupes et les
 * scènes, pour l'application bureau.
 *
 * Chaque famille est cherchée par la requête de son registre, avec les mêmes
 * champs que la barre de recherche de ce registre : un résultat trouvé ici se
 * retrouve là-bas. Les scènes n'ont pas de recherche au hub — l'agenda se
 * filtre, il ne se cherche pas — donc elles se filtrent ici sur le titre et le
 * résumé des scènes publiques à venir, en mémoire : l'agenda public tient en
 * une lecture.
 *
 * Sans lecteur : rien de privé ne sort, ni groupe ni scène.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < LONGUEUR_MINIMALE) {
    return NextResponse.json(
      { erreur: `La recherche demande au moins ${LONGUEUR_MINIMALE} caractères.` },
      { status: 400 },
    );
  }
  const limite = lireLimite(searchParams, LIMITE_PAR_DEFAUT, LIMITE_MAXIMALE);
  const regex = searchRegex(q);

  const [lieux, personnages, groupes, scenes] = await Promise.all([
    listPlaces({ query: q, pageSize: limite }),
    listCharacters({ query: q, pageSize: limite }),
    listGroups({ viewer: null, query: q }),
    listEvents({ viewer: null, access: "publiques" }),
  ]);

  const evenements = scenes
    .filter((scene) => regex.test(scene.title) || (scene.summary ? regex.test(scene.summary) : false))
    .slice(0, limite);

  return NextResponse.json({
    q,
    lieux: { total: lieux.total, items: lieux.items.map(formeLieuResume) },
    personnages: { total: personnages.total, items: personnages.items.map(formePersonnage) },
    groupes: { total: groupes.length, items: groupes.slice(0, limite).map(formeGroupe) },
    evenements: { total: evenements.length, items: evenements.map(formeEvenement) },
  });
}
