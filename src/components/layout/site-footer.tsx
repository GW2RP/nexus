import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t-2 border-rule bg-surface">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-gutter-mobile py-6 text-[15px] text-ink-muted sm:flex-row sm:items-center sm:justify-between lg:px-gutter-desktop">
        <span>
          Hub communautaire de jeu de rôle · non affilié à ArenaNet ni à NCSOFT.
          Guild Wars 2 © ArenaNet, LLC.
        </span>
        <nav aria-label="Liens de pied de page">
          <ul className="flex flex-wrap gap-6">
            <li>
              <Link href="/signaler" className="text-crimson-ink underline-offset-4 hover:underline">
                Signaler un contenu
              </Link>
            </li>
            <li>
              <Link href="/regles" className="text-crimson-ink underline-offset-4 hover:underline">
                Règles du hub
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
