/** Le squelette d'une grille de cartes.
 *
 *  Il ne remplace plus la page entière : seule la liste s'absente pendant qu'on
 *  la refait, et l'en-tête, la recherche et les filtres restent sous la main.
 *  Un filtre qui disparaît au moment où on le change donne l'impression d'un
 *  rechargement complet ; c'était le cas, et ce n'en est plus un. */
export function CardGridSkeleton({
  count = 6,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
}: {
  count?: number;
  columns?: string;
}) {
  return (
    <div>
      <span className="sr-only" role="status">
        Chargement de la liste
      </span>
      <div aria-hidden="true" className={`grid gap-5 lg:gap-6 ${columns}`}>
        {Array.from({ length: count }, (_, index) => (
          <div key={index} className="flex flex-col gap-3 border border-rule bg-surface p-6">
            <div className="h-5 w-24 bg-surface-inset" />
            <div className="h-6 w-3/4 bg-surface-inset" />
            <div className="h-4 w-full bg-surface-inset" />
            <div className="h-4 w-2/3 bg-surface-inset" />
          </div>
        ))}
      </div>
    </div>
  );
}
