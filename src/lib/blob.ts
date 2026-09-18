import "server-only";

import { del } from "@vercel/blob";

/** Le ménage du stockage d'images.
 *
 *  Une image téléversée vit dans Vercel Blob, pas dans MongoDB : supprimer la
 *  fiche qui la portait ne l'emporte pas. Sans ce ménage, une adresse publique
 *  reste servie indéfiniment pour un contenu qui n'existe plus.
 */

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/** Une adresse saisie à la main, ou venue d'avant le téléversement, ne nous
 *  appartient pas : on n'essaie pas de la supprimer. */
function isOurBlob(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Supprime les images passées, et ne fait jamais échouer l'appelant.
 *
 *  Perdre une image est moins grave que de laisser une fiche en place parce que
 *  le stockage n'a pas répondu : la suppression du contenu prime, l'échec du
 *  ménage part au journal. */
export async function deleteUploadedImages(
  urls: (string | null | undefined)[],
): Promise<void> {
  const ours = [...new Set(urls.filter(isOurBlob))];
  if (ours.length === 0) return;

  try {
    await del(ours);
  } catch (error) {
    console.error("Images non supprimées du stockage :", ours, error);
  }
}
