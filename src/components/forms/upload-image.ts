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
  // Le tirage rend le chemin unique : deux co-gérants qui téléversent dans le
  // même dossier à la même milliseconde ne se heurtent pas.
  const tirage = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const pathname = `${folder}/${ownerId}/${Date.now()}-${tirage}.${extension}`;
  await checkQuota(file.size);
  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/televersement",
    contentType: file.type,
  });
  return result.url;
}

/** Le quota d'un compte se tient au serveur, qui n'émet de jeton que pour ce
 *  qui reste. Mais un jeton refusé n'arrive ici que comme un échec sans
 *  phrase : on demande d'abord ce qui reste, pour dire pourquoi. Si la
 *  question elle-même échoue, on tente quand même — le serveur tranchera. */
async function checkQuota(size: number): Promise<void> {
  let quota: { restant: number; message: string } | null = null;
  try {
    const response = await fetch("/api/televersement", { cache: "no-store" });
    if (response.ok) quota = await response.json();
  } catch {
    quota = null;
  }
  if (quota && size > quota.restant) throw new Error(quota.message);
}

/** Le message à montrer quand un téléversement échoue. */
export function uploadFailureMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : UPLOAD_FAILED;
}
