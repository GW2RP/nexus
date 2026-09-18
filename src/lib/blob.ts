import "server-only";

import { del } from "@vercel/blob";

/** Le ménage du stockage d'images.
 *
 *  Une image téléversée vit dans Vercel Blob, pas dans MongoDB : supprimer la
 *  fiche qui la portait ne l'emporte pas. Sans ce ménage, une adresse publique
 *  reste servie indéfiniment pour un contenu qui n'existe plus.
 *
 *  Le nom du fichier porte l'identifiant de l'auteur du contenu :
 *  `lieux/<auteur>/<horodatage>.jpg`. C'est ce cloisonnement qui rend la
 *  suppression sûre — sans lui, il suffirait d'inscrire l'adresse de l'image
 *  d'un autre membre dans sa propre fiche, puis de supprimer celle-ci, pour
 *  faire détruire le fichier d'autrui.
 */

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export const IMAGE_FOLDERS = ["personnages", "lieux", "evenements"] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

/** Le chemin sous lequel une image est rangée dans le magasin. */
export function blobPathname(folder: ImageFolder, ownerId: string, extension: string): string {
  return `${folder}/${ownerId}/${Date.now()}.${extension}`;
}

/** Une adresse est-elle servie par un magasin Blob ? */
export function isBlobUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** Le chemin d'un blob, découpé : dossier, propriétaire, fichier. */
export function readBlobPath(
  url: string,
): { folder: string; ownerId: string; file: string } | null {
  try {
    const segments = new URL(url).pathname.replace(/^\//, "").split("/");
    if (segments.length !== 3) return null;
    const [folder, ownerId, file] = segments;
    if (!folder || !ownerId || !file) return null;
    return { folder, ownerId, file };
  } catch {
    return null;
  }
}

/** Le chemin demandé est-il celui d'une image rangée sous ce propriétaire ? */
export function isPathnameOwnedBy(pathname: string, ownerId: string): boolean {
  const segments = pathname.replace(/^\//, "").split("/");
  if (segments.length !== 3) return false;
  const [folder, owner, file] = segments;
  return (
    (IMAGE_FOLDERS as readonly string[]).includes(folder) && owner === ownerId && Boolean(file)
  );
}

/** Supprime les images d'un contenu, et ne fait jamais échouer l'appelant.
 *
 *  Seules les images rangées sous `ownerId` sont touchées : une adresse glissée
 *  dans une fiche pour désigner le fichier de quelqu'un d'autre est ignorée.
 *
 *  Perdre une image est moins grave que de laisser une fiche en place parce que
 *  le stockage n'a pas répondu : la suppression du contenu prime, l'échec du
 *  ménage part au journal. */
export async function deleteUploadedImages(
  urls: (string | null | undefined)[],
  ownerId: string,
): Promise<void> {
  const candidates = [...new Set(urls.filter(isBlobUrl))];

  const ours: string[] = [];
  for (const url of candidates) {
    const path = readBlobPath(url);
    if (path && path.ownerId === ownerId && (IMAGE_FOLDERS as readonly string[]).includes(path.folder)) {
      ours.push(url);
    } else {
      console.warn("Image non rangée sous l'auteur du contenu, laissée en place :", url);
    }
  }

  if (ours.length === 0) return;

  try {
    await del(ours);
  } catch (error) {
    console.error("Images non supprimées du stockage :", ours, error);
  }
}
