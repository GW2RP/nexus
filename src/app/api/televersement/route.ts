import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { isPathnameOwnedBy, readBlobPathname } from "@/lib/blob";
import { Place } from "@/models/place";
import { connectToDatabase } from "@/lib/mongoose";
import { canContribute, isAdmin } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

/** Le téléversement des images passe par le navigateur : le fichier va droit au
 *  stockage Vercel Blob, sans traverser la fonction serveur — dont le corps de
 *  requête est plafonné à 4,5 Mo. Cette route ne délivre que le jeton, après
 *  avoir vérifié que la personne a le droit de publier. */

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;


/** Un co-gérant téléverse la bannière d'un lieu qui n'est pas de lui : l'image
 *  doit quand même se ranger sous l'auteur du lieu, sinon la suppression de la
 *  fiche la laisserait derrière elle — `deleteUploadedImages` ne touche que ce
 *  qui est rangé sous l'auteur du contenu supprimé.
 *
 *  L'ouverture est étroite : le seul dossier concerné est « lieux », et le seul
 *  propriétaire admis est celui d'un lieu que cette personne co-gère. */
async function coManagesPlaceOf(pathname: string, userId: string): Promise<boolean> {
  const path = readBlobPathname(pathname);
  if (!path || path.folder !== "lieux" || path.ownerId === userId) return false;

  await connectToDatabase();
  return Boolean(await Place.exists({ authorId: path.ownerId, managerIds: userId }));
}

export async function POST(request: Request): Promise<NextResponse> {
  // Un corps vide ou mal formé ressort en 400 avec un message à nous : sans
  // cette garde il remontait en 500, et le message brut de `JSON.parse` est en
  // anglais et parle de l'intérieur du programme.
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "Requête de téléversement illisible." },
      { status: 400 },
    );
  }

  // Le droit de publier se vérifie avant d'appeler `handleUpload`, qui échouerait
  // d'abord sur la configuration du magasin et noierait le vrai refus.
  // La requête de fin de téléversement vient de Vercel Blob, sans session : elle
  // ne passe pas par là.
  if (body.type === "blob.generate-client-token") {
    const user = await getCurrentUser();
    if (!canContribute(user)) {
      return NextResponse.json(
        { error: "Le téléversement demande un compte actif." },
        { status: 403 },
      );
    }

    // Le chemin range l'image sous l'auteur du contenu — `lieux/<auteur>/…`.
    // C'est ce cloisonnement qui rend la suppression sûre, donc il se vérifie
    // ici : personne n'écrit dans le dossier d'un autre, sauf l'administration
    // qui peut déjà modifier le contenu de tout le monde.
    const pathname = body.payload?.pathname ?? "";
    const allowed =
      isPathnameOwnedBy(pathname, user.id) ||
      isAdmin(user) ||
      (await coManagesPlaceOf(pathname, user.id));
    if (!allowed) {
      return NextResponse.json(
        { error: "Cette image ne peut pas être rangée là." },
        { status: 403 },
      );
    }
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Deuxième verrou : `handleUpload` est le seul à savoir quand le jeton
        // est réellement émis.
        const user = await getCurrentUser();
        if (!canContribute(user)) {
          throw new Error("Le téléversement demande un compte actif.");
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          // Deux personnes peuvent téléverser « banniere.jpg » : le suffixe évite
          // qu'elles s'écrasent l'une l'autre.
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // L'adresse est enregistrée par le formulaire qui a lancé le téléversement ;
        // rien à faire ici, mais Vercel Blob attend le rappel.
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    // Jeton absent, magasin injoignable… : le détail regarde l'exploitation,
    // pas la personne qui téléverse.
    console.error("Téléversement impossible :", error);
    return NextResponse.json(
      { error: "Le téléversement n'a pas abouti. Réessayez dans un moment." },
      { status: 400 },
    );
  }
}

