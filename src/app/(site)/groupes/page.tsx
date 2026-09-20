import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { GroupCard } from "@/components/content/group-card";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/card-grid-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterChips } from "@/components/ui/filter-chips";
import { PageHeader } from "@/components/ui/page-header";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
import { canContribute } from "@/lib/permissions";
import { buildMetadata } from "@/lib/seo";
import { getCurrentUser } from "@/lib/session";
import { listGroups } from "@/server/queries/groups";

export const metadata: Metadata = buildMetadata({
  title: "Groupes",
  description:
    "Les cercles de la communauté : compagnies, guildes et conspirations, avec leurs membres et les scènes qu'ils annoncent entre eux.",
  path: "/groupes",
  keywords: ["groupe RP Guild Wars 2", "guilde roleplay GW2", "cercle RP Tyrie"],
});

type Params = Record<string, string | string[] | undefined>;

/** Les groupes. Comme les autres registres, la page ne suspend pas : seule sa
 *  liste le fait, pour que l'en-tête et les filtres restent à l'écran pendant
 *  que la liste arrive. */
export default function GroupsPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-[1280px] px-gutter-mobile py-10 lg:px-gutter-desktop">
      <PageHeader
        title="Groupes"
        subtitle={
          <Suspense fallback={null}>
            <Compte searchParams={searchParams} />
          </Suspense>
        }
        action={
          <Suspense fallback={<BoutonCreer href="/connexion" />}>
            <BoutonSelonLeCompte />
          </Suspense>
        }
      />

      <UrlFilters>
        <SearchToolbar searchLabel="Rechercher un groupe" searchPlaceholder="Nom du cercle…" />

        <div className="mb-8">
          <FilterChips
            name="portee"
            legend="Filtrer les groupes"
            allLabel="TOUS LES GROUPES"
            options={[{ value: "miens", label: "LES MIENS" }]}
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

function lireOptions(params: Params) {
  return {
    query: typeof params.q === "string" ? params.q : undefined,
    mine: params.portee === "miens",
  };
}

async function Compte({ searchParams }: { searchParams: Promise<Params> }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const groups = await listGroups({ ...lireOptions(params), viewer: user });
  if (groups.length === 0) return null;
  const miens = groups.filter((group) => group.viewerIsMember).length;
  return `${groups.length} cercle${groups.length > 1 ? "s" : ""}${
    miens > 0 ? ` · vous êtes membre de ${miens} d'entre eux` : ""
  }`;
}

function BoutonCreer({ href }: { href: string }) {
  return (
    <Button asChild size="lead">
      <Link href={href}>CRÉER UN GROUPE</Link>
    </Button>
  );
}

async function BoutonSelonLeCompte() {
  const user = await getCurrentUser();
  return <BoutonCreer href={canContribute(user) ? "/groupes/nouveau" : "/connexion"} />;
}

async function Resultats({ searchParams }: { searchParams: Promise<Params> }) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const groups = await listGroups({ ...lireOptions(params), viewer: user });

  if (groups.length === 0) {
    return (
      <EmptyState
        title="Aucun cercle"
        action={
          <Button asChild variant="outline">
            <Link href={canContribute(user) ? "/groupes/nouveau" : "/connexion"}>
              CRÉER UN GROUPE
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {groups.map((group) => (
        <li key={group.id} className="flex">
          <GroupCard group={group} />
        </li>
      ))}
    </ul>
  );
}
