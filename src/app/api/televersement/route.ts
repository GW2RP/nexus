import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { canContribute } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

/** Le téléversement des images passe par le navigateur : le fichier va droit au
 *  stockage Vercel Blob, sans traverser la fonction serveur — dont le corps de
 *  requête est plafonné à 4,5 Mo. Cette route ne délivre que le jeton, après
 *  avoir vérifié que la personne a le droit de publier. */

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
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
    const message =
      error instanceof Error ? error.message : "Le téléversement n'a pas abouti.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
