"use client";

import { upload } from "@vercel/blob/client";

/** Le téléversement d'une image depuis le navigateur.
 *
 *  Le fichier va droit au magasin, sans traverser la fonction serveur — dont le
 *  corps de requête est plafonné à 4,5 Mo. La route ne délivre que le jeton, et
 *  vérifie que le chemin range bien l'image sous l'auteur du contenu.
 *
 *  Une bannière et une image glissée dans un texte suivent le même chemin : ce
 *  qui les distingue est l'endroit où l'adresse est ensuite écrite, pas la façon
 *  dont le fichier arrive. */

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const TOO_LARGE = "L'image dépasse 5 Mo. Réduisez-la avant de la téléverser.";
export const UPLOAD_FAILED = "Le téléversement n'a pas abouti. Réessayez.";

/** Téléverse le fichier et renvoie son adresse publique.
 *  Lève un `Error` dont le message est en français et affichable tel quel. */
export async function uploadImage(
  file: File,
  folder: string,
  ownerId: string,
): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error(TOO_LARGE);

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const result = await upload(`${folder}/${ownerId}/${Date.now()}.${extension}`, file, {
    access: "public",
    handleUploadUrl: "/api/televersement",
    contentType: file.type,
  });
  return result.url;
}

/** Le message à montrer quand un téléversement échoue. */
export function uploadFailureMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : UPLOAD_FAILED;
}
