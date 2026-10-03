import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ImageInventory, ImageInventoryFilters } from "@/components/content/image-inventory";
import { PageHeader } from "@/components/ui/page-header";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { deleteImagesAction } from "@/server/actions/images";
import { inventoryOf } from "@/server/images";

export const metadata: Metadata = buildMetadata({
  title: "Mes images",
  description: "Les images que vous avez téléversées sur le hub GW2RP Nexus.",
  path: "/mon-compte/images",
  noIndex: true,
});

type Params = Record<string, string | string[] | undefined>;

/** Ce que le compte héberge, image par image. La page ne suspend pas : seule
 *  la liste attend le magasin. */
export default function MyImagesPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 md:px-gutter-app xl:px-gutter-desktop">
      <UrlFilters>
        <PageHeader eyebrow="MON COMPTE" title="Mes images" />
        <ImageInventoryFilters />
        <PendingResults>
          <Suspense fallback={null}>
            <Inventaire searchParams={searchParams} />
          </Suspense>
        </PendingResults>
      </UrlFilters>
    </div>
  );
}

async function Inventaire({ searchParams }: { searchParams: Promise<Params> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  if (!user) redirect("/connexion?suite=/mon-compte/images");
  const images = await inventoryOf(user.id);
  return (
    <ImageInventory
      images={images}
      onlyOrphans={params.filtre === "orphelines"}
      deleteAction={deleteImagesAction.bind(null, user.id)}
    />
  );
}
