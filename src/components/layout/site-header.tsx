import Link from "next/link";

import { NexusMark } from "@/components/icons";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { RoundPortrait } from "@/components/ui/framed-media";
import { isAdmin } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/session";

export const NAV_ITEMS = [
  { href: "/carte", label: "Carte" },
  { href: "/personnages", label: "Personnages" },
  { href: "/lieux", label: "Lieux" },
  { href: "/evenements", label: "Évènements" },
  { href: "/groupes", label: "Groupes" },
  { href: "/rumeurs", label: "Rumeurs" },
] as const;

/** L'en-tête du hub.
 *
 *  Entre `lg` et `xl` — un iPad à l'horizontale —, la barre complète ne tient
 *  pas dans la largeur : tout passait sur deux lignes, le nom du hub comme
 *  « Se connecter » et le bouton d'inscription. On y garde la navigation et on
 *  allège le reste : le compte se réduit à son portrait, l'inscription attend
 *  `xl` (la page de connexion y mène), et pour l'administration, qui ajoute un
 *  lien, le nom du hub cède sa place à sa marque. Rien ne passe à la ligne :
 *  `whitespace-nowrap` partout où un libellé de deux mots se coupait. */
export async function SiteHeader() {
  const user = await getCurrentUser();
  const admin = isAdmin(user);

  return (
    <header className="border-b-2 border-rule bg-surface">
      <div className="mx-auto flex min-h-[82px] max-w-[1280px] items-center justify-between gap-6 px-gutter-mobile py-3 md:px-gutter-app xl:px-gutter-desktop">
        <Link href="/" className="flex shrink-0 items-center gap-[14px] text-gold" aria-label="GW2RP Nexus, accueil">
          <NexusMark size={28} />
          <span
            className={cn(
              "whitespace-nowrap font-display text-[17px] font-bold tracking-[3px] text-ink xl:text-[19px]",
              admin && "lg:hidden xl:inline",
            )}
          >
            GW2RP NEXUS
          </span>
        </Link>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-5 lg:flex xl:gap-[30px]"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href} className="whitespace-nowrap">
              {item.label}
            </NavLink>
          ))}
          {admin ? (
            <NavLink href="/admin/signalements" className="whitespace-nowrap">
              Administration
            </NavLink>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-3 xl:gap-4">
          <ThemeToggle />
          {user ? (
            <Link
              href="/mon-compte"
              aria-label={`Mon compte : ${user.name}`}
              className="hidden items-center gap-3 whitespace-nowrap text-[17px] text-ink-body hover:text-ink lg:inline-flex"
            >
              <RoundPortrait src={user.image} alt="" size={34} />
              <span className="hidden xl:inline">{user.name}</span>
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden whitespace-nowrap py-3 text-[17px] text-ink-body hover:text-ink lg:inline-block"
              >
                Se connecter
              </Link>
              <Button asChild className="hidden whitespace-nowrap xl:inline-flex">
                <Link href="/inscription">CRÉER UN COMPTE</Link>
              </Button>
            </>
          )}
          <MobileNav items={[...NAV_ITEMS]} isAdmin={admin} userName={user?.name ?? null} />
        </div>
      </div>
    </header>
  );
}
