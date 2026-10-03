import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ImageInventory, ImageInventoryFilters } from "@/components/content/image-inventory";
import { PageHeader } from "@/components/ui/page-header";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
import { buildMetadata } from "@/lib/seo";
import { deleteImagesAction } from "@/server/actions/images";
import { inventoryOf } from "@/server/images";
import { getUserName } from "@/server/queries/users";

export const metadata: Metadata = buildMetadata({
  title: "Images d'un compte",
  description: "Les images qu'un compte héberge sur le hub.",
  path: "/admin/utilisateurs",
  noIndex: true,
});

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/** L'inventaire d'un compte, lu par l'administration : le même que celui de
 *  « Mes images », et les mêmes orphelines à supprimer. */
export default async function UserImagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const name = await getUserName(id);
  if (!name) notFound();

  return (
    <div className="mx-auto max-w-[1440px]">
      <UrlFilters>
        <PageHeader eyebrow="IMAGES" title={name} />
        <ImageInventoryFilters />
        <PendingResults>
          <Suspense fallback={null}>
            <Inventaire userId={id} searchParams={searchParams} />
          </Suspense>
        </PendingResults>
      </UrlFilters>
    </div>
  );
}

async function Inventaire({
  userId,
  searchParams,
}: {
  userId: string;
  searchParams: Promise<Params>;
}) {
  const [images, query] = await Promise.all([inventoryOf(userId), searchParams]);
  return (
    <ImageInventory
      images={images}
      onlyOrphans={query.filtre === "orphelines"}
      deleteAction={deleteImagesAction.bind(null, userId)}
    />
  );
}
