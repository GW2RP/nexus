import type { Metadata } from "next";
import Link from "next/link";

import { PlaceCard } from "@/components/content/place-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/page-header";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import {
  PLACE_TYPES,
  PLACE_TYPE_LABELS,
  REGIONS,
  REGION_LABELS,
  type PlaceType,
  type Region,
} from "@/lib/domain";
import { canContribute } from "@/lib/permissions";
import { SITE_URL, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listPlaces } from "@/server/queries/places";

export const metadata: Metadata = buildMetadata({
  title: "Registre des lieux",
  description:
    "Tavernes, sièges de guilde, ruines et comptoirs tenus par la communauté : les lieux où se jouent les scènes, avec leur emplacement en Tyrie et leur plan intérieur.",
  path: "/lieux",
  keywords: ["lieux RP Guild Wars 2", "taverne RP Tyrie", "siège de guilde GW2"],
});

export const revalidate = 300;

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  const type = typeof params.type === "string" ? (params.type as PlaceType) : undefined;
  const region = typeof params.region === "string" ? (params.region as Region) : undefined;
  const page = Number(params.page ?? 1) || 1;

  const { items, total, hasMore } = await listPlaces({
    query: typeof params.q === "string" ? params.q : undefined,
    type: PLACE_TYPES.includes(type as PlaceType) ? type : undefined,
    region: REGIONS.includes(region as Region) ? region : undefined,
    page,
    pageSize: 12 * page,
  });

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Registre des lieux",
    url: `${SITE_URL}/lieux`,
    inLanguage: "fr-FR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.slice(0, 20).map((place, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/lieux/${place.slug}`,
        name: place.name,
      })),
    },
  };

  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listJsonLd)} />

      <PageHeader
        title="Registre des lieux"
        subtitle={
          total > 0
            ? `${total} lieu${total > 1 ? "x" : ""} posé${total > 1 ? "s" : ""} sur la carte de Tyrie.`
            : "Aucun lieu n'a encore été posé sur la carte."
        }
        action={
          <Button asChild size="lead">
            <Link href={canContribute(user) ? "/lieux/nouveau" : "/connexion"}>
              PROPOSER UN LIEU
            </Link>
          </Button>
        }
      />

      <SearchToolbar searchLabel="Rechercher un lieu" searchPlaceholder="Taverne, guilde, ruine…" />

      <div className="mb-8 flex flex-col gap-3">
        <FilterChips
          name="type"
          legend="Filtrer par type de lieu"
          allLabel="TOUS LES TYPES"
          options={PLACE_TYPES.map((value) => ({
            value,
            label: PLACE_TYPE_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
        <FilterChips
          name="region"
          legend="Filtrer par région"
          allLabel="TOUTE LA TYRIE"
          options={REGIONS.map((value) => ({
            value,
            label: REGION_LABELS[value].toLocaleUpperCase("fr-FR"),
          }))}
        />
      </div>

      {items.length > 0 ? (
        <>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {items.map((place) => (
              <li key={place.id} className="flex">
                <PlaceCard place={place} />
              </li>
            ))}
          </ul>
          <LoadMore page={page} hasMore={hasMore} searchParams={params} />
        </>
      ) : (
        <EmptyState
          title="Aucun lieu ne correspond"
          description="Retirez un filtre, ou posez le vôtre : un lieu porte son emplacement en Tyrie et, si vous en avez un, son plan intérieur."
          action={
            <Button asChild variant="outline">
              <Link href={canContribute(user) ? "/lieux/nouveau" : "/connexion"}>
                PROPOSER UN LIEU
              </Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
