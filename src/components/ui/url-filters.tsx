"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useTransition } from "react";

import { cn } from "@/lib/utils";

/** Les filtres d'un registre vivent dans l'URL — c'est ce qui permet de
 *  partager un lien de liste filtrée. Changer de filtre est donc une
 *  navigation, et une navigation vers une page rendue à la requête prend le
 *  temps d'un aller-retour.
 *
 *  Ce qu'on peut supprimer, c'est **l'attente muette**. La navigation part dans
 *  une transition : React garde la liste précédente à l'écran au lieu de la
 *  remplacer par un squelette, et `pending` dit qu'une autre arrive. La puce
 *  cliquée, elle, s'allume tout de suite — elle n'attend pas le serveur pour
 *  montrer ce qu'on vient de lui demander.
 *
 *  La transition est partagée par le fournisseur : les puces l'ouvrent, la
 *  liste la lit pour s'estomper. Sans cela chaque contrôle aurait la sienne et
 *  aucun ne saurait ce que font les autres. */

type Changes = Record<string, string | null>;

type Filtres = {
  /** Change des paramètres d'URL. `optimistic` s'exécute dans la transition,
   *  pour que l'état affiché devance la réponse. */
  go: (changes: Changes, optimistic?: () => void) => void;
  /** Une navigation de filtre est en cours. */
  pending: boolean;
};

const Contexte = createContext<Filtres | null>(null);

function useNavigation(): Filtres {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const go = useCallback(
    (changes: Changes, optimistic?: () => void) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      // Un changement de filtre remet la liste à sa première page.
      params.delete("page");
      const query = params.toString();
      const href = query ? `${pathname}?${query}` : pathname;

      startTransition(() => {
        optimistic?.();
        router.push(href, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  return useMemo(() => ({ go, pending }), [go, pending]);
}

/** Le fournisseur : il entoure les contrôles **et** la liste qu'ils filtrent. */
export function UrlFilters({ children }: { children: React.ReactNode }) {
  const filtres = useNavigation();
  return <Contexte.Provider value={filtres}>{children}</Contexte.Provider>;
}

/** La transition partagée, ou une transition à soi hors d'un fournisseur : un
 *  contrôle posé seul continue de fonctionner, il n'a simplement personne à
 *  qui annoncer son attente. */
export function useUrlFilters(): Filtres {
  const local = useNavigation();
  return useContext(Contexte) ?? local;
}

/** La liste pendant qu'une autre arrive : estompée, et annoncée comme occupée.
 *  Elle reste lisible — on voit ce qu'on quitte, pas un rectangle gris. */
export function PendingResults({ children }: { children: React.ReactNode }) {
  const { pending } = useUrlFilters();
  return (
    <div
      aria-busy={pending}
      className={cn(
        "transition-opacity duration-150 motion-reduce:transition-none",
        pending && "opacity-50",
      )}
    >
      {children}
    </div>
  );
}
