import "server-only";

import { del, list } from "@vercel/blob";

import { isBlobUrl } from "@/lib/images";

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

export { collectMarkdownImages, isBlobUrl } from "@/lib/images";

export const IMAGE_FOLDERS = ["personnages", "lieux", "evenements", "groupes", "panneaux"] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];

/** Le chemin sous lequel une image est rangée dans le magasin. */
export function blobPathname(folder: ImageFolder, ownerId: string, extension: string): string {
  return `${folder}/${ownerId}/${Date.now()}.${extension}`;
}

type BlobPath = { folder: string; ownerId: string; file: string };

/** Un chemin de rangement, découpé : dossier, propriétaire, fichier. */
export function readBlobPathname(pathname: string): BlobPath | null {
  const segments = pathname.replace(/^\//, "").split("/");
  if (segments.length !== 3) return null;
  const [folder, ownerId, file] = segments;
  if (!folder || !ownerId || !file) return null;
  return { folder, ownerId, file };
}

/** Le chemin d'un blob, découpé : dossier, propriétaire, fichier. */
export function readBlobPath(url: string): BlobPath | null {
  try {
    return readBlobPathname(new URL(url).pathname);
  } catch {
    return null;
  }
}

/** Le chemin demandé est-il celui d'une image rangée sous ce propriétaire ? */
export function isPathnameOwnedBy(pathname: string, ownerId: string): boolean {
  const path = readBlobPathname(pathname);
  if (!path) return false;
  return (
    (IMAGE_FOLDERS as readonly string[]).includes(path.folder) && path.ownerId === ownerId
  );
}

/** Ce que ce compte héberge, en octets : la somme de ses dossiers du magasin.
 *
 *  Le magasin fait foi, pas la base. Une image n'y entre que par le
 *  téléversement et n'en sort que par le ménage : compter ce qu'il garde sous
 *  un propriétaire, c'est compter exactement ce qu'il paie — y compris l'image
 *  d'un panneau qui attend dans la corbeille, puisqu'on peut encore l'en
 *  rétablir.
 *
 *  L'image qu'un co-gérant pose sur un lieu se range sous l'auteur du lieu, et
 *  c'est donc à lui qu'elle compte : c'est sa fiche qui la porte. */
export async function imageUsage(ownerId: string): Promise<number> {
  const totals = await Promise.all(
    IMAGE_FOLDERS.map(async (folder) => {
      let total = 0;
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `${folder}/${ownerId}/`, cursor, limit: 1000 });
        for (const blob of page.blobs) total += blob.size;
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return total;
    }),
  );
  return totals.reduce((sum, one) => sum + one, 0);
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

/** Le ménage après une modification : ce que le contenu portait, ce qu'il porte
 *  encore, et la différence part au magasin.
 *
 *  Une bannière remplacée n'est plus le seul cas : un texte long porte ses
 *  propres images, et en effacer une dans l'éditeur doit l'emporter aussi.
 *  Comparer les deux listes évite de supprimer ce qui a seulement été déplacé
 *  d'un paragraphe à l'autre. */
export async function deleteOrphanedImages(
  before: (string | null | undefined)[],
  after: (string | null | undefined)[],
  ownerId: string,
): Promise<void> {
  const kept = new Set(after.filter((url): url is string => Boolean(url)));
  const dropped = before.filter((url): url is string => typeof url === "string" && url.length > 0 && !kept.has(url));
  if (dropped.length === 0) return;
  await deleteUploadedImages(dropped, ownerId);
}
