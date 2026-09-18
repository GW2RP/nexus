"use client";

import { MoonIcon, SunIcon } from "@/components/icons";

/** La bascule de thème. La préférence est stockée ; à défaut on suit le système.
 *  L'icône affichée est choisie par CSS d'après `data-theme`, pas par un état
 *  React : le bouton reste juste dès le premier rendu, sans flash ni
 *  désaccord d'hydratation. */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("gw2rp-theme", next);
    } catch {
      // Navigation privée ou stockage refusé : le thème tient pour la session.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Basculer entre le thème clair et le thème sombre"
      className="inline-flex size-tap items-center justify-center border border-rule text-gold-ink hover:bg-surface-selected"
    >
      <MoonIcon size={17} className="dark:hidden" />
      <SunIcon size={17} className="hidden dark:block" />
    </button>
  );
}
