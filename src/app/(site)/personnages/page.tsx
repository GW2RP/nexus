import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { CharacterCard } from "@/components/content/character-card";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { LoadMore } from "@/components/ui/load-more";
import { PageHeader } from "@/components/ui/page-header";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
import { RACES, RACE_LABELS, type Race } from "@/lib/domain";
import { canContribute } from "@/lib/permissions";
import { SITE_URL, buildMetadata, jsonLdScript } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { countCharacters, listCharacters, type CharacterSort } from "@/server/queries/characters";

export const metadata: Metadata = buildMetadata({
  title: "Registre des personnages",
  description:
    "Les fiches de personnages tenues par la communauté : humains, charrs, norns, asuras et sylvaris qui font vivre le jeu de rôle en Tyrie.",
  path: "/personnages",
  keywords: ["personnages RP GW2", "fiche de personnage Guild Wars 2", "registre RP"],
});

const SORT_OPTIONS = [
  { value: "recents", label: "Fiches récentes" },
  { value: "alphabetique", label: "Ordre alphabétique" },
  { value: "anciens", label: "Plus anciens en jeu" },
];

type Params = Record<string, string | string[] | undefined>;

/** Le registre.
 *
 *  La page elle-même **n'attend rien** : elle rend son en-tête, sa recherche et
 *  ses filtres sans toucher ni à la session ni à la base. Ce qui attend est
 *  enfermé dans des `Suspense`, et seul ce qui attend s'absente.
 *
 *  C'est ce qui change au clic d'un filtre. Une page dont le corps commence par
 *  `await` ne peut rien rendre avant d'avoir sa réponse : elle suspend en
 *  entier, et le `loading.tsx` du groupe remplaçait alors tout l'écran —
 *  y compris les filtres qu'on venait de toucher. On ne remplace plus que la
 *  liste, et pendant ce temps la précédente reste lisible, estompée. */
export default function CharactersPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        title="Registre des personnages"
        subtitle={
          <Suspense fallback={null}>
            <Compte />
          </Suspense>
        }
        action={
          <Suspense fallback={<BoutonCreer href="/connexion" />}>
            <BoutonSelonLeCompte />
          </Suspense>
        }
      />

      <UrlFilters>
        <SearchToolbar
          searchLabel="Rechercher un personnage"
          searchPlaceholder="Nom, titre, guilde…"
          sortOptions={SORT_OPTIONS}
          toggles={[{ name: "portrait", label: "Avec portrait" }]}
        />

        <FilterChips
          name="race"
          legend="Filtrer par race"
          allLabel="TOUTES LES RACES"
          options={RACES.map((value) => ({
            value,
            label: RACE_LABELS[value].neutre.toLocaleUpperCase("fr-FR"),
          }))}
          className="mb-8"
        />

        <PendingResults>
          <Suspense
            fallback={<CardGridSkeleton count={8} columns="sm:grid-cols-2 lg:grid-cols-4" />}
          >
            <Resultats searchParams={searchParams} />
          </Suspense>
        </PendingResults>
      </UrlFilters>
    </div>
  );
}

async function Compte() {
  const counts = await countCharacters();
  if (counts.total === 0) return null;
  return `${counts.total} fiche${counts.total > 1 ? "s" : ""} · ${counts.recent} cette saison`;
}

function BoutonCreer({ href }: { href: string }) {
  return (
    <Button asChild size="lead">
      <Link href={href}>CRÉER UN PERSONNAGE</Link>
    </Button>
  );
}

async function BoutonSelonLeCompte() {
  const user = await getCurrentUser();
  return <BoutonCreer href={canContribute(user) ? "/personnages/nouveau" : "/connexion"} />;
}

async function Resultats({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;

  const race = typeof params.race === "string" ? (params.race as Race) : undefined;
  const sort = typeof params.tri === "string" ? (params.tri as CharacterSort) : "recents";
  const page = Number(params.page ?? 1) || 1;

  const { items, total, hasMore } = await listCharacters({
    query: typeof params.q === "string" ? params.q : undefined,
    race: RACES.includes(race as Race) ? race : undefined,
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : "recents",
    withPortrait: params.portrait === "1",
    page,
    pageSize: 12 * page,
  });

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune fiche ne correspond"
        action={
          <Suspense fallback={null}>
            <LienCreer />
          </Suspense>
        }
      />
    );
  }

  const listJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Registre des personnages",
    url: `${SITE_URL}/personnages`,
    inLanguage: "fr-FR",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: items.slice(0, 20).map((character, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/personnages/${character.slug}`,
        name: character.name,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(listJsonLd)} />
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        {items.map((character) => (
          <li key={character.id} className="flex">
            <CharacterCard character={character} />
          </li>
        ))}
      </ul>
      <LoadMore page={page} hasMore={hasMore} searchParams={params} />
    </>
  );
}

async function LienCreer() {
  const user = await getCurrentUser();
  return (
    <Button asChild variant="outline">
      <Link href={canContribute(user) ? "/personnages/nouveau" : "/connexion"}>
        CRÉER UN PERSONNAGE
      </Link>
    </Button>
  );
}
