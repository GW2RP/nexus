/** Ce qu'une image téléversée a de reconnaissable, des deux côtés de la
 *  frontière.
 *
 *  `src/lib/blob.ts` est `server-only` : le ménage du magasin n'a rien à faire
 *  dans un navigateur. Mais la lecture d'une fiche, elle, doit savoir reconnaître
 *  une adresse de notre magasin — c'est à cette condition qu'on rend une image
 *  écrite dans un texte. Ces deux fonctions-là vivent donc à part. */

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/** Une adresse est-elle servie par un magasin Blob ? */
export function isBlobUrl(url: unknown): url is string {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

/** `![alternative](adresse "titre")` — l'adresse, éventuellement entre chevrons. */
const IMAGE_MARKDOWN = /!\[[^\]]*\]\(\s*<?([^\s<>)]+)>?[^)]*\)/g;

/** Les images posées dans un texte markdown.
 *
 *  Un texte long porte désormais ses propres images, et pas seulement sa
 *  bannière : sans cette lecture, supprimer une fiche laisserait derrière elle
 *  tout ce que son auteur y avait glissé. Seules les adresses du magasin
 *  ressortent — `deleteUploadedImages` écarterait les autres de toute façon, et
 *  les compter ici ne ferait que grossir la liste. */
export function collectMarkdownImages(...texts: (string | null | undefined)[]): string[] {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const [, url] of text.matchAll(IMAGE_MARKDOWN)) {
      if (isBlobUrl(url)) found.add(url);
    }
  }
  return [...found];
}
