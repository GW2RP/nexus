import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { imageUsage, isPathnameOwnedBy, readBlobPathname } from "@/lib/blob";
import { IMAGE_QUOTA_BYTES, formatMegaoctets } from "@/lib/images";
import { Place } from "@/models/place";
import { connectToDatabase } from "@/lib/mongoose";
import { canContribute, isAdmin } from "@/lib/permissions";
import { getCurrentUser, type SessionUser } from "@/lib/session";

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

/** Le chemin demandé range-t-il l'image là où cette personne a le droit
 *  d'écrire ? C'est ce cloisonnement qui rend la suppression sûre : personne
 *  n'écrit dans le dossier d'un autre, sauf l'administration qui peut déjà
 *  modifier le contenu de tout le monde, et le co-gérant d'un lieu. */
async function mayWriteTo(pathname: string, user: SessionUser): Promise<boolean> {
  return (
    isPathnameOwnedBy(pathname, user.id) ||
    isAdmin(user) ||
    (await coManagesPlaceOf(pathname, user.id))
  );
}

/** Ce qui reste au propriétaire du chemin, en octets. Le quota est celui du
 *  dossier où l'image se range, donc de celui qui la paie. */
async function remainingFor(pathname: string): Promise<{ used: number; remaining: number } | null> {
  const path = readBlobPathname(pathname);
  if (!path) return null;
  const used = await imageUsage(path.ownerId);
  return { used, remaining: Math.max(0, IMAGE_QUOTA_BYTES - used) };
}

function quotaMessage(used: number): string {
  return `L'image ne tient plus dans les ${formatMegaoctets(IMAGE_QUOTA_BYTES)} du compte : ${formatMegaoctets(used)} sont déjà hébergés.`;
}

/** Ce qui reste avant le plafond, pour que le navigateur refuse un fichier
 *  trop lourd avec un message à nous : un refus de jeton ne lui parvient que
 *  comme un échec sans phrase. Le plafond, lui, se tient au jeton. */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!canContribute(user)) {
    return NextResponse.json({ error: "Le téléversement demande un compte actif." }, { status: 403 });
  }
  const pathname = new URL(request.url).searchParams.get("chemin") ?? "";
  if (!(await mayWriteTo(pathname, user))) {
    return NextResponse.json({ error: "Cette image ne peut pas être rangée là." }, { status: 403 });
  }
  try {
    const quota = await remainingFor(pathname);
    if (!quota) {
      return NextResponse.json({ error: "Cette image ne peut pas être rangée là." }, { status: 403 });
    }
    return NextResponse.json(
      {
        utilise: quota.used,
        restant: quota.remaining,
        plafond: IMAGE_QUOTA_BYTES,
        message: quotaMessage(quota.used),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Quota d'images illisible :", error);
    return NextResponse.json({ error: "Le quota n'a pas pu être relu." }, { status: 503 });
  }
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
    const pathname = body.payload?.pathname ?? "";
    if (!(await mayWriteTo(pathname, user))) {
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
      onBeforeGenerateToken: async (pathname) => {
        // Deuxième verrou : `handleUpload` est le seul à savoir quand le jeton
        // est réellement émis.
        const user = await getCurrentUser();
        if (!canContribute(user)) {
          throw new Error("Le téléversement demande un compte actif.");
        }
        // Le quota se tient ici, et non sur la taille que le navigateur
        // annonce : le jeton n'autorise que ce qui reste au propriétaire du
        // dossier, et le magasin refuse le fichier qui dépasse.
        const quota = await remainingFor(pathname);
        if (!quota || quota.remaining <= 0) {
          throw new Error(quotaMessage(quota?.used ?? IMAGE_QUOTA_BYTES));
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: Math.min(MAX_BYTES, quota.remaining),
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

