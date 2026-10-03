import Link from "next/link";

import { DeleteContent } from "@/components/content/delete-content";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import type { ActionState } from "@/lib/action-state";
import { formatLongDate } from "@/lib/dates";
import { IMAGE_QUOTA_BYTES, formatMegaoctets } from "@/lib/images";
import type { InventoriedImage } from "@/server/images";

/** Les filtres de l'inventaire : tout, ou seulement ce qui ne sert plus. */
export function ImageInventoryFilters() {
  return (
    <FilterChips
      name="filtre"
      legend="Filtrer les images"
      allLabel="TOUTES"
      options={[{ value: "orphelines", label: "ORPHELINES" }]}
      className="mb-6"
    />
  );
}

/** L'inventaire des images d'un compte, tel que lui ou l'administration le
 *  lit. Une orpheline — une image qu'aucun contenu ne montre plus — porte sa
 *  puce et se supprime d'ici ; une image qui sert dit où, et se retire de là. */
export function ImageInventory({
  images,
  onlyOrphans,
  deleteAction,
}: {
  images: InventoriedImage[];
  onlyOrphans: boolean;
  deleteAction: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const used = images.reduce((sum, image) => sum + image.size, 0);
  const orphans = images.filter((image) => image.uses.length === 0);
  const orphanWeight = orphans.reduce((sum, image) => sum + image.size, 0);
  const shown = onlyOrphans ? orphans : images;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <p className="meta text-ink-muted">
          {images.length} image{images.length > 1 ? "s" : ""} · {formatMegaoctets(used)} sur{" "}
          {formatMegaoctets(IMAGE_QUOTA_BYTES)} · {orphans.length} orpheline
          {orphans.length > 1 ? "s" : ""} ({formatMegaoctets(orphanWeight)})
        </p>
        {onlyOrphans && orphans.length > 1 ? (
          <DeleteContent
            id={orphans.map((image) => image.url).join("\n")}
            action={deleteAction}
            title={`${orphans.length} images orphelines`}
            question="Supprimer toutes les images orphelines ?"
            consequence={`Elles quittent le stockage et libèrent ${formatMegaoctets(orphanWeight)}. Aucun contenu ne les montre.`}
            verb="TOUT SUPPRIMER"
          />
        ) : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState title={onlyOrphans ? "Aucune image orpheline" : "Aucune image"} />
      ) : (
        <ul className="flex flex-col border-t border-hairline">
          {shown.map((image) => (
            <ImageRow key={image.url} image={image} deleteAction={deleteAction} />
          ))}
        </ul>
      )}
    </>
  );
}

function ImageRow({
  image,
  deleteAction,
}: {
  image: InventoriedImage;
  deleteAction: (previous: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const file = image.pathname.split("/").pop() ?? image.pathname;
  const orphan = image.uses.length === 0;

  return (
    <li className="flex flex-wrap items-start gap-4 border-b border-hairline py-4">
      <a
        href={image.url}
        target="_blank"
        rel="noreferrer"
        className="block size-24 shrink-0 border border-rule bg-surface-inset"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={`Aperçu de ${file}`} loading="lazy" className="size-full object-cover" />
      </a>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="break-all body-compact text-ink">{file}</p>
        <p className="meta text-ink-muted">
          {formatMegaoctets(image.size)} · le {formatLongDate(new Date(image.uploadedAt))}
        </p>
        {orphan ? (
          <Badge variant="outline" className="self-start">
            ORPHELINE
          </Badge>
        ) : (
          <ul className="flex flex-col gap-1">
            {image.uses.map((use) => (
              <li key={`${use.href}-${use.label}`} className="meta">
                <Link href={use.href} className="text-ink-body underline hover:text-ink">
                  {use.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {orphan ? (
        <DeleteContent
          id={image.url}
          action={deleteAction}
          title={file}
          question="Supprimer cette image ?"
          consequence={`Elle quitte le stockage et libère ${formatMegaoctets(image.size)}. Aucun contenu ne la montre.`}
          verb="SUPPRIMER"
        />
      ) : null}
    </li>
  );
}
