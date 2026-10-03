import "server-only";

import { BlobNotFoundError, head, list } from "@vercel/blob";

import { IMAGE_FOLDERS, readBlobPathname } from "@/lib/blob";
import { Board } from "@/models/board";
import { Character } from "@/models/character";
import { Event } from "@/models/event";
import { Group } from "@/models/group";
import { Place } from "@/models/place";
import { Rumor } from "@/models/rumor";
import { UploadedImage } from "@/models/uploaded-image";
import { connectToDatabase } from "@/server/queries/shared";

/** L'inventaire des images d'un compte : ce qu'il a téléversé, ce que cela
 *  pèse, et où chaque image sert encore.
 *
 *  Le magasin fait foi pour l'existence et la taille d'un fichier ; le
 *  registre (`UploadedImage`) ne dit que qui a téléversé ce qui est rangé dans
 *  le dossier d'un autre. Une image appartient donc à celui que le registre
 *  nomme, et à défaut au propriétaire de son dossier — c'est aussi le cas de
 *  tout ce qui a été téléversé avant le registre.
 *
 *  Rien ne passe par `remember` : l'inventaire change à chaque téléversement,
 *  qui ne passe par aucune action, et il ne se lit qu'à la demande. */

export type ImageEntry = {
  url: string;
  pathname: string;
  folder: string;
  /** Le propriétaire du dossier : l'auteur du contenu qui la porte. */
  ownerId: string;
  size: number;
  uploadedAt: string;
};

export type ImageUse = { label: string; href: string };

export type InventoriedImage = ImageEntry & { uses: ImageUse[] };

/** Les fichiers rangés sous les dossiers d'un compte. */
async function listOwnFolders(userId: string): Promise<ImageEntry[]> {
  const pages = await Promise.all(
    IMAGE_FOLDERS.map(async (folder) => {
      const found: ImageEntry[] = [];
      let cursor: string | undefined;
      do {
        const page = await list({ prefix: `${folder}/${userId}/`, cursor, limit: 1000 });
        for (const blob of page.blobs) {
          found.push({
            url: blob.url,
            pathname: blob.pathname,
            folder,
            ownerId: userId,
            size: blob.size,
            uploadedAt: blob.uploadedAt.toISOString(),
          });
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return found;
    }),
  );
  return pages.flat();
}

/** Les images qu'un compte a téléversées, où qu'elles soient rangées. */
export async function listImagesOf(userId: string): Promise<ImageEntry[]> {
  await connectToDatabase();
  const [own, rows] = await Promise.all([
    listOwnFolders(userId),
    UploadedImage.find({ $or: [{ uploaderId: userId }, { ownerId: userId }] } as never).lean(),
  ]);

  // Ce qu'un autre a téléversé dans nos dossiers est à lui.
  const theirs = new Set(
    rows.filter((row) => row.uploaderId !== userId).map((row) => row.pathname),
  );
  const entries = own.filter((entry) => !theirs.has(entry.pathname));

  // Ce que nous avons téléversé dans les dossiers d'un autre : le registre
  // le nomme, le magasin dit s'il existe encore et ce qu'il pèse.
  const elsewhere = rows.filter((row) => row.uploaderId === userId && row.ownerId !== userId);
  const found = await Promise.all(
    elsewhere.map(async (row) => {
      try {
        const blob = await head(row.pathname);
        const path = readBlobPathname(blob.pathname);
        if (!path) return null;
        return {
          url: blob.url,
          pathname: blob.pathname,
          folder: path.folder,
          ownerId: path.ownerId,
          size: blob.size,
          uploadedAt: blob.uploadedAt.toISOString(),
        } satisfies ImageEntry;
      } catch (error) {
        // Un jeton jamais servi, ou un fichier supprimé depuis : la ligne ne
        // désigne plus rien.
        if (error instanceof BlobNotFoundError) {
          await UploadedImage.deleteOne({ pathname: row.pathname } as never);
          return null;
        }
        throw error;
      }
    }),
  );

  return [...entries, ...found.filter((entry): entry is ImageEntry => entry !== null)].sort(
    (a, b) => b.uploadedAt.localeCompare(a.uploadedAt),
  );
}

/** Ce que pèsent les images d'un compte, en octets. */
export async function imageUsage(userId: string): Promise<number> {
  const entries = await listImagesOf(userId);
  return entries.reduce((sum, entry) => sum + entry.size, 0);
}

/** Les contenus où chaque image sert encore.
 *
 *  Une image se range sous l'auteur du contenu qui la porte, donc on ne relit
 *  que les contenus de ces auteurs-là — fiches, lieux, scènes, groupes,
 *  rumeurs —, entiers : une adresse peut se trouver dans une bannière, un
 *  plan ou au milieu d'un texte, et chercher l'adresse dans le document entier
 *  ne laisse aucun champ de côté. Une fiche masquée par la modération compte :
 *  elle peut être rétablie. Les images de panneau se cherchent sur tous les
 *  panneaux, corbeille comprise — « annuler » peut encore les rétablir. */
export async function findImageUses(entries: ImageEntry[]): Promise<Map<string, ImageUse[]>> {
  await connectToDatabase();
  const uses = new Map<string, ImageUse[]>(entries.map((entry) => [entry.url, []]));
  if (entries.length === 0) return uses;

  const owners = [...new Set(entries.map((entry) => entry.ownerId))];
  const byAuthor = { authorId: { $in: owners } } as never;
  const [characters, places, events, groups, rumors] = await Promise.all([
    Character.find(byAuthor).lean(),
    Place.find(byAuthor).lean(),
    Event.find(byAuthor).lean(),
    Group.find(byAuthor).lean(),
    Rumor.find(byAuthor).lean(),
  ]);

  const documents: { text: string; use: ImageUse }[] = [
    ...characters.map((doc) => ({
      text: JSON.stringify(doc),
      use: { label: `Personnage « ${doc.name} »`, href: `/personnages/${doc.slug}` },
    })),
    ...places.map((doc) => ({
      text: JSON.stringify(doc),
      use: { label: `Lieu « ${doc.name} »`, href: `/lieux/${doc.slug}` },
    })),
    ...events.map((doc) => ({
      text: JSON.stringify(doc),
      use: { label: `Scène « ${doc.title} »`, href: `/evenements/${doc.slug}` },
    })),
    ...groups.map((doc) => ({
      text: JSON.stringify(doc),
      use: { label: `Groupe « ${doc.name} »`, href: `/groupes/${doc.slug}` },
    })),
    ...rumors.map((doc) => ({
      text: JSON.stringify(doc),
      use: { label: "Rumeur", href: `/rumeurs#rumeur-${String(doc._id)}` },
    })),
  ];
  for (const entry of entries) {
    for (const document of documents) {
      if (document.text.includes(entry.url)) uses.get(entry.url)!.push(document.use);
    }
  }

  const boardUrls = entries.map((entry) => entry.url);
  const boards = await Board.find({
    $or: [{ "elements.src": { $in: boardUrls } }, { "removed.src": { $in: boardUrls } }],
  } as never)
    .select({ name: 1, ownerType: 1, groupId: 1, placeId: 1, "elements.src": 1, "removed.src": 1 })
    .lean();
  if (boards.length > 0) {
    const [boardGroups, boardPlaces] = await Promise.all([
      Group.find({ _id: { $in: boards.map((board) => board.groupId).filter(Boolean) } } as never)
        .select({ slug: 1 })
        .lean(),
      Place.find({ _id: { $in: boards.map((board) => board.placeId).filter(Boolean) } } as never)
        .select({ slug: 1 })
        .lean(),
    ]);
    const groupSlugs = new Map(boardGroups.map((doc) => [String(doc._id), doc.slug]));
    const placeSlugs = new Map(boardPlaces.map((doc) => [String(doc._id), doc.slug]));
    for (const board of boards) {
      const href =
        board.ownerType === "lieu"
          ? `/lieux/${placeSlugs.get(String(board.placeId)) ?? ""}/panneau`
          : `/groupes/${groupSlugs.get(String(board.groupId)) ?? ""}/panneaux/${String(board._id)}`;
      const srcs = new Set(
        [...(board.elements ?? []), ...(board.removed ?? [])].map((element) => element.src),
      );
      for (const url of boardUrls) {
        if (srcs.has(url)) uses.get(url)!.push({ label: `Panneau « ${board.name} »`, href });
      }
    }
  }

  return uses;
}

/** L'inventaire complet d'un compte, les plus récentes d'abord. */
export async function inventoryOf(userId: string): Promise<InventoriedImage[]> {
  const entries = await listImagesOf(userId);
  const uses = await findImageUses(entries);
  return entries.map((entry) => ({ ...entry, uses: uses.get(entry.url) ?? [] }));
}
