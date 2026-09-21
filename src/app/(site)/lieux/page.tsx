import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PlaceCard } from "@/components/content/place-card";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterSelect } from "@/components/ui/filter-select";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/page-header";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
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
    "Tavernes, sièges de guilde, domaines, maisons, campements, ruines et comptoirs tenus par la communauté : les lieux où se jouent les scènes, avec leur emplacement en Tyrie et leur plan intérieur.",
  path: "/lieux",
  keywords: ["lieux RP Guild Wars 2", "taverne RP Tyrie", "siège de guilde GW2"],
});

type Params = Record<string, string | string[] | undefined>;

/** Les options de lecture, tirées de l'URL. Le sous-titre et la liste comptent
 *  la même chose : sans cette fonction, l'un dirait « 2 lieux » pendant que
 *  l'autre en montrerait un. Les deux appels retombent sur la même entrée de
 *  cache, donc cela ne fait pas une requête de plus. */
function lireOptions(params: Params) {
  const type = typeof params.type === "string" ? (params.type as PlaceType) : undefined;
  const region = typeof params.region === "string" ? (params.region as Region) : undefined;
  return {
    query: typeof params.q === "string" ? params.q : undefined,
    type: PLACE_TYPES.includes(type as PlaceType) ? type : undefined,
    region: REGIONS.includes(region as Region) ? region : undefined,
    page: Number(params.page ?? 1) || 1,
  };
}

/** Le registre des lieux. Même découpage que celui des personnages : la page
 *  ne suspend pas, seule la liste le fait. */
export default function PlacesPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        title="Registre des lieux"
        subtitle={
          <Suspense fallback={null}>
            <Compte searchParams={searchParams} />
          </Suspense>
        }
        action={
          <Suspense fallback={<BoutonProposer href="/connexion" />}>
            <BoutonSelonLeCompte />
          </Suspense>
        }
      />

      <UrlFilters>
        <SearchToolbar
          searchLabel="Rechercher un lieu"
          searchPlaceholder="Taverne, guilde, ruine…"
        />

        {/* Deux listes déroulantes plutôt que quinze boutons : les filtres
            tiennent sur une ligne, et la première fiche revient dans l'écran. */}
        <div className="mb-8 flex flex-wrap items-end gap-4">
          <FilterSelect
            name="type"
            label="Type de lieu"
            allLabel="Tous les types"
            options={PLACE_TYPES.map((value) => ({
              value,
              label: PLACE_TYPE_LABELS[value],
            }))}
          />
          <FilterSelect
            name="region"
            label="Région"
            allLabel="Toute la Tyrie"
            options={REGIONS.map((value) => ({ value, label: REGION_LABELS[value] }))}
          />
        </div>

        <PendingResults>
          <Suspense fallback={<CardGridSkeleton count={6} />}>
            <Resultats searchParams={searchParams} />
          </Suspense>
        </PendingResults>
      </UrlFilters>
    </div>
  );
}

async function Compte({ searchParams }: { searchParams: Promise<Params> }) {
  const options = lireOptions(await searchParams);
  const { total } = await listPlaces({ ...options, pageSize: 12 * options.page });
  if (total === 0) return null;
  return `${total} lieu${total > 1 ? "x" : ""}`;
}

function BoutonProposer({ href }: { href: string }) {
  return (
    <Button asChild size="lead">
      <Link href={href}>PROPOSER UN LIEU</Link>
    </Button>
  );
}

async function BoutonSelonLeCompte() {
  const user = await getCurrentUser();
  return <BoutonProposer href={canContribute(user) ? "/lieux/nouveau" : "/connexion"} />;
}

async function Resultats({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const options = lireOptions(params);
  const page = options.page;

  const { items, total, hasMore } = await listPlaces({ ...options, pageSize: 12 * page });

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucun lieu ne correspond"
        action={
          <Suspense fallback={null}>
            <LienProposer />
          </Suspense>
        }
      />
    );
  }

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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listJsonLd)} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {items.map((place) => (
          <li key={place.id} className="flex">
            <PlaceCard place={place} />
          </li>
        ))}
      </ul>
      <LoadMore page={page} hasMore={hasMore} searchParams={params} />
    </>
  );
}

async function LienProposer() {
  const user = await getCurrentUser();
  return (
    <Button asChild variant="outline">
      <Link href={canContribute(user) ? "/lieux/nouveau" : "/connexion"}>PROPOSER UN LIEU</Link>
    </Button>
  );
}
