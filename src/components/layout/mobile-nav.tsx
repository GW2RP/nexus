"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CloseIcon, MenuIcon } from "@/components/icons";
import { SignOutButton } from "@/components/layout/sign-out-button";

export function MobileNav({
  items,
  isAdmin,
  userName,
}: {
  items: { href: string; label: string }[];
  isAdmin: boolean;
  userName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Une navigation ferme le panneau : sans cela il resterait ouvert sur la page
  // suivante. L'ajustement se fait pendant le rendu — pas dans un effet, qui
  // ferait peindre le panneau ouvert avant de le refermer.
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="navigation-mobile"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="inline-flex size-tap items-center justify-center border border-rule text-gold-ink"
      >
        {open ? <CloseIcon size={17} /> : <MenuIcon size={17} />}
      </button>

      {open ? (
        <div
          id="navigation-mobile"
          className="absolute inset-x-0 z-40 border-b-2 border-rule bg-surface px-gutter-mobile py-4"
        >
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href} className="border-b border-hairline">
                <Link
                  href={item.href}
                  className="flex min-h-tap items-center text-[19px] text-ink-body"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {isAdmin ? (
              <li className="border-b border-hairline">
                <Link
                  href="/admin/signalements"
                  className="flex min-h-tap items-center text-[19px] text-ink-body"
                >
                  Administration
                </Link>
              </li>
            ) : null}
            {userName ? (
              <>
                <li className="border-b border-hairline">
                  <Link
                    href="/mon-compte"
                    className="flex min-h-tap items-center text-[19px] text-ink-body"
                  >
                    {userName}
                  </Link>
                </li>
                <li>
                  <SignOutButton className="flex min-h-tap items-center text-[19px] text-crimson-ink" />
                </li>
              </>
            ) : (
              <>
                <li className="border-b border-hairline">
                  <Link
                    href="/connexion"
                    className="flex min-h-tap items-center text-[19px] text-ink-body"
                  >
                    Se connecter
                  </Link>
                </li>
                <li>
                  <Link
                    href="/inscription"
                    className="flex min-h-tap items-center text-[19px] text-crimson-ink"
                  >
                    Créer un compte
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
