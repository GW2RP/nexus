import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-ground">
      <SiteHeader />
      <main id="contenu" className="flex-1">
        <div className="mx-auto max-w-[840px] px-gutter-mobile py-16 md:px-gutter-app xl:px-gutter-desktop">
          <p className="mb-4 font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
            PAGE INTROUVABLE
          </p>
          <h1 className="font-display text-[36px] font-bold leading-[1.1] sm:text-[44px]">
            Cette page n'est pas au registre
          </h1>
          <p className="mt-5 max-w-[60ch] body text-ink-body">
            Le lien est peut-être ancien, ou le contenu a été retiré par son auteur ou par
            l'équipe. Les quatre portes du hub restent ouvertes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lead">
              <Link href="/">RETOUR À L'ACCUEIL</Link>
            </Button>
            <Button asChild variant="outline" size="lead">
              <Link href="/carte">OUVRIR LA CARTE</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
