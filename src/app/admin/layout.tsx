import Link from "next/link";
import { redirect } from "next/navigation";

import { NexusMark } from "@/components/icons";
import { NavLink } from "@/components/layout/nav-link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isAdmin } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/session";

/** L'administration a sa propre mise en page plein écran : gouttière de 32 px,
 *  pas de pied de page, et le chemin de retour au hub toujours visible. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion?suite=/admin/signalements");
  if (!isAdmin(user)) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <header className="border-b-2 border-rule bg-surface">
        <div className="flex min-h-[82px] flex-wrap items-center justify-between gap-4 px-gutter-mobile py-3 lg:px-gutter-app">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 text-gold">
              <NexusMark size={24} />
              <span className="font-display text-[15px] font-bold tracking-[3px] text-ink">
                ADMINISTRATION
              </span>
            </Link>
          </div>

          <nav aria-label="Navigation de l'administration" className="flex flex-wrap gap-6">
            <NavLink href="/admin/signalements">Signalements</NavLink>
            <NavLink href="/admin/terrains">Terrains</NavLink>
        <NavLink href="/admin/journal">Journal</NavLink>
          </nav>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/" className="text-[17px] text-ink-body hover:text-ink">
              Retour au hub
            </Link>
          </div>
        </div>
      </header>

      <main id="contenu" className="flex-1 px-gutter-mobile py-8 lg:px-gutter-app">
        {children}
      </main>
    </div>
  );
}
