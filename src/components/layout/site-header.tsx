import Link from "next/link";

import { NexusMark } from "@/components/icons";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { RoundPortrait } from "@/components/ui/framed-media";
import { isAdmin } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

export const NAV_ITEMS = [
  { href: "/carte", label: "Carte" },
  { href: "/personnages", label: "Personnages" },
  { href: "/lieux", label: "Lieux" },
  { href: "/evenements", label: "Évènements" },
  { href: "/rumeurs", label: "Rumeurs" },
] as const;

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="border-b-2 border-rule bg-surface">
      <div className="mx-auto flex min-h-[82px] max-w-[1280px] items-center justify-between gap-6 px-gutter-mobile py-3 lg:px-gutter-desktop">
        <Link href="/" className="flex items-center gap-[14px] text-gold">
          <NexusMark size={28} />
          <span className="font-display text-[17px] font-bold tracking-[3px] text-ink lg:text-[19px]">
            GW2RP NEXUS
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-[30px] lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
          {isAdmin(user) ? <NavLink href="/admin/signalements">Administration</NavLink> : null}
        </nav>

        <div className="flex items-center gap-3 lg:gap-4">
          <ThemeToggle />
          {user ? (
            <Link
              href="/mon-compte"
              className="hidden items-center gap-3 text-[17px] text-ink-body hover:text-ink lg:inline-flex"
            >
              <RoundPortrait src={user.image} alt="" size={34} />
              {user.name}
            </Link>
          ) : (
            <>
              <Link
                href="/connexion"
                className="hidden py-3 text-[17px] text-ink-body hover:text-ink lg:inline-block"
              >
                Se connecter
              </Link>
              <Button asChild className="hidden lg:inline-flex">
                <Link href="/inscription">CRÉER UN COMPTE</Link>
              </Button>
            </>
          )}
          <MobileNav
            items={[...NAV_ITEMS]}
            isAdmin={isAdmin(user)}
            userName={user?.name ?? null}
          />
        </div>
      </div>
    </header>
  );
}
