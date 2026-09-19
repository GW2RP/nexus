"use client";

import { upload } from "@vercel/blob/client";
import { useRef, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const ACCEPTED = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 5 * 1024 * 1024;

/** Le téléversement d'une image, avec son alternative textuelle.
 *  L'alternative est exigée dès qu'une image est posée : sans elle, la fiche
 *  devient illisible pour qui n'a pas l'image. */
export function ImageField({
  label,
  name,
  altName,
  folder,
  ownerId,
  hint,
  aspect = "16 / 5",
  defaultUrl,
  defaultAlt,
  error,
  altError,
}: {
  label: string;
  /** Le champ qui porte l'adresse de l'image. */
  name: string;
  /** Le champ qui porte l'alternative textuelle. */
  altName: string;
  /** Le dossier de rangement dans le stockage : « personnages », « lieux »… */
  folder: string;
  /** L'auteur du contenu : l'image est rangée sous lui, et seule la suppression
   *  de son contenu pourra l'emporter. */
  ownerId: string;
  hint?: string;
  aspect?: string;
  defaultUrl?: string | null;
  defaultAlt?: string | null;
  error?: string;
  altError?: string;
}) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [alt, setAlt] = useState(defaultAlt ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFailure(null);

    if (file.size > MAX_BYTES) {
      setFailure("L'image dépasse 5 Mo. Réduisez-la avant de la téléverser.");
      return;
    }

    setBusy(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const result = await upload(`${folder}/${ownerId}/${Date.now()}.${extension}`, file, {
        access: "public",
        handleUploadUrl: "/api/televersement",
        contentType: file.type,
      });
      setUrl(result.url);
    } catch (uploadError) {
      setFailure(
        uploadError instanceof Error
          ? uploadError.message
          : "Le téléversement n'a pas abouti. Réessayez.",
      );
    } finally {
      setBusy(false);
      // Sans cela, re-choisir le même fichier après un échec ne déclenche rien.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={name} value={url} />

      <div className="flex flex-col gap-2">
        <span className="meta text-ink-muted">{label}</span>

        <div className="framed">
          <div
            className={cn(
              "relative w-full overflow-hidden border border-rule",
              !url && "hatch",
            )}
            style={{ aspectRatio: aspect }}
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={alt} className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center px-4 text-center font-display text-[11px] font-medium tracking-[1.4px] text-gold-eyebrow">
                [ AUCUNE IMAGE ]
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id={`${name}-fichier`}
            type="file"
            accept={ACCEPTED}
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="sr-only"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {busy ? "TÉLÉVERSEMENT…" : url ? "REMPLACER L'IMAGE" : "TÉLÉVERSER UNE IMAGE"}
          </Button>

          {url ? (
            <button
              type="button"
              onClick={() => setUrl("")}
              className="inline-flex min-h-tap items-center gap-2 px-2 text-[16px] text-ink-muted hover:text-ink"
            >
              <CloseIcon size={14} />
              Retirer
            </button>
          ) : null}
        </div>

        {hint ? <p className="caption text-ink-subtle">{hint}</p> : null}
        {failure ? (
          <p role="alert" className="caption text-crimson-ink">
            {failure}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="caption text-crimson-ink">
            {error}
          </p>
        ) : null}
      </div>

      {url ? (
        <Field
          label="Alternative textuelle"
          htmlFor={altName}
          required
          hint="Ce que voit quelqu'un qui n'a pas l'image."
          error={altError}
        >
          <Input
            id={altName}
            name={altName}
            required
            maxLength={240}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </Field>
      ) : (
        <input type="hidden" name={altName} value="" />
      )}
    </div>
  );
}
