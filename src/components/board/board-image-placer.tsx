"use client";

import { useRef, useState } from "react";

import {
  ACCEPTED_IMAGE_TYPES,
  uploadFailureMessage,
  uploadImage,
} from "@/components/forms/upload-image";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { BOARD_IMAGE_FOLDER, LEGEND_MAX, imageSize } from "@/lib/boards";

/** Poser une image sur le panneau par son outil.
 *
 *  L'alternative se propose avant le fichier, mais elle n'est pas exigée : sur
 *  un panneau, une image collée depuis le presse-papier arrive sans elle, et
 *  l'inspecteur la donne ensuite. L'image se range sous celui qui la
 *  téléverse, dans son dossier de panneaux, et compte dans son quota. */
export function BoardImagePlacer({
  ownerId,
  onPlaced,
  onCancel,
}: {
  ownerId: string;
  onPlaced: (image: { src: string; alt: string; w: number; h: number }) => void;
  onCancel: () => void;
}) {
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFailure(null);
    setBusy(true);
    try {
      onPlaced(await uploadBoardImage(file, ownerId, alt.trim()));
    } catch (uploadError) {
      setFailure(uploadFailureMessage(uploadError));
    } finally {
      setBusy(false);
      // Sans cela, re-choisir le même fichier après un échec ne déclenche rien.
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="eyebrow text-gold-eyebrow">POSER UNE IMAGE</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="image-alternative">Alternative textuelle</Label>
        <Input
          id="image-alternative"
          value={alt}
          maxLength={LEGEND_MAX}
          autoFocus
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Ce que voit quelqu'un qui n'a pas l'image"
        />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <p className="caption text-ink-subtle">JPEG, PNG, WebP ou AVIF. 5 Mo au plus.</p>
      {failure ? (
        <p role="alert" className="caption text-crimson-ink">
          {failure}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "TÉLÉVERSEMENT…" : "CHOISIR L'IMAGE"}
        </Button>
        <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={onCancel}>
          ANNULER
        </Button>
      </div>
    </div>
  );
}

/** Téléverse une image de panneau et rend ce qu'il faut pour la poser : son
 *  adresse, son alternative et sa taille. La proportion se lit sur le fichier
 *  avant qu'il parte : l'image arrive à sa forme d'origine, pas dans un cadre
 *  imposé. */
export async function uploadBoardImage(
  file: File,
  ownerId: string,
  alt = "",
): Promise<{ src: string; alt: string; w: number; h: number }> {
  const natural = await naturalSize(file);
  const src = await uploadImage(file, BOARD_IMAGE_FOLDER, ownerId);
  return { src, alt, ...imageSize(natural.width, natural.height) };
}

/** Les dimensions d'origine d'un fichier image, lues dans le navigateur. Un
 *  fichier illisible rend zéro : l'image se posera carrée, sans faire échouer
 *  le téléversement. */
function naturalSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}
