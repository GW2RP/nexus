import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { SearchToolbar } from "@/components/ui/search-toolbar";
import { PendingResults, UrlFilters } from "@/components/ui/url-filters";
import { ROLE_LABELS } from "@/lib/domain";
import { formatLongDate } from "@/lib/dates";
import { buildMetadata } from "@/lib/seo";
import { listUsers, type UserSort } from "@/server/queries/users";

export const metadata: Metadata = buildMetadata({
  title: "Utilisateurs",
  description: "Les comptes inscrits sur le hub.",
  path: "/admin/utilisateurs",
  noIndex: true,
});

export const dynamic = "force-dynamic";

const SORT_OPTIONS: { value: UserSort; label: string }[] = [
  { value: "recents", label: "Inscription récente" },
  { value: "anciens", label: "Inscription ancienne" },
];

const HEADERS = ["Pseudo", "Adresse mail", "Rôle", "Inscription", "État"];

type Params = Record<string, string | string[] | undefined>;

/** La liste des comptes. Comme un registre, la page n'attend rien : seule la
 *  liste suspend, et la recherche reste à l'écran pendant qu'elle arrive. */
export default function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  return (
    <div className="mx-auto max-w-[1440px]">
      <UrlFilters>
        <PageHeader title="Utilisateurs" />

        <SearchToolbar
          searchLabel="Rechercher un compte"
          searchPlaceholder="Pseudo ou adresse mail…"
          sortLabel="Trier par"
          sortOptions={SORT_OPTIONS}
        />

        <PendingResults>
          <Suspense fallback={null}>
            <Resultats searchParams={searchParams} />
          </Suspense>
        </PendingResults>
      </UrlFilters>
    </div>
  );
}

function lire(params: Params) {
  const sort = SORT_OPTIONS.some((option) => option.value === params.tri)
    ? (params.tri as UserSort)
    : "recents";
  return {
    query: typeof params.q === "string" ? params.q : undefined,
    sort,
    page: Number(params.page ?? 1) || 1,
  };
}

async function Resultats({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { items, total, page, pageCount } = await listUsers(lire(params));

  if (items.length === 0) return <EmptyState title="Aucun compte ne correspond" />;

  return (
    <>
      <p className="meta mb-3 text-ink-muted">
        {total} compte{total > 1 ? "s" : ""}
      </p>
      <div className="overflow-x-auto border border-rule">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <caption className="sr-only">Comptes inscrits, page {page} sur {pageCount}</caption>
          <thead>
            <tr className="border-b border-rule bg-surface">
              {HEADERS.map((header) => (
                <th
                  key={header}
                  scope="col"
                  className="px-4 py-3 font-display text-[11px] font-medium tracking-[1.4px] text-ink-muted"
                >
                  {header.toLocaleUpperCase("fr-FR")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((user) => (
                <tr key={user.id} className="border-b border-hairline bg-surface last:border-b-0">
                  <th scope="row" className="px-4 py-4 align-top font-normal body-compact text-ink">
                    {user.name}
                  </th>
                  <td className="px-4 py-4 align-top body-compact break-all text-ink-body">
                    {user.email}
                  </td>
                  <td className="px-4 py-4 align-top body-compact text-ink-body">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </td>
                  <td className="px-4 py-4 align-top body-compact text-ink-muted">
                    <time dateTime={user.createdAt}>
                      {formatLongDate(new Date(user.createdAt))}
                    </time>
                  </td>
                  <td className="px-4 py-4 align-top body-compact">
                    {user.suspendedUntil ? (
                      <span className="text-crimson-ink">
                        Suspendu jusqu&apos;au {formatLongDate(new Date(user.suspendedUntil))}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Actif</span>
                    )}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} searchParams={params} />
    </>
  );
}
