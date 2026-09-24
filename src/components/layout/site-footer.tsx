import Link from "next/link";

/** Le pied de page. Mention et liens se côtoient sur un grand écran ; en
 *  dessous de `xl`, côte à côte, la mention se coupait en deux lignes et les
 *  liens en deux rangs. Ils s'empilent donc, et chaque lien tient sur sa ligne. */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-rule bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-gutter-mobile py-6 text-[15px] text-ink-muted xl:flex-row xl:items-center xl:justify-between xl:gap-8 md:px-gutter-app xl:px-gutter-desktop">
        <span>
          Hub communautaire de jeu de rôle · non affilié à ArenaNet ni à NCSOFT.
          Guild Wars 2 © ArenaNet, LLC.
        </span>
        <nav aria-label="Liens de pied de page">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 whitespace-nowrap">
            <li>
              <Link href="/signaler" className="text-crimson-ink underline-offset-4 hover:underline">
                Signaler un contenu
              </Link>
            </li>
            <li>
              <Link href="/regles" className="text-crimson-ink underline-offset-4 hover:underline">
                Règlement d'usage
              </Link>
            </li>
            <li>
              <Link href="/a-propos" className="text-crimson-ink underline-offset-4 hover:underline">
                À propos
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
