"use client";

import { cn } from "@/lib/utils";

/** Une option en cartouche : le choix se lit en entier — son libellé et ce
 *  qu'il entraîne — et la cible fait toute la ligne.
 *
 *  C'est le motif des décisions qui changent la nature d'un contenu : publique
 *  ou privée, hebdomadaire ou mensuelle. Une liste déroulante cacherait ce que
 *  chaque option veut dire jusqu'à ce qu'on l'ait choisie. */
export function ChoiceRow({
  name,
  value,
  checked,
  onSelect,
  title,
  hint,
  children,
}: {
  name: string;
  value: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-[14px]",
        // Le cadre passe de 1 à 2 px quand l'option est choisie : le padding
        // compense d'un pixel pour que la ligne ne saute pas au clic.
        checked
          ? "border-2 border-gold bg-surface-selected p-[15px]"
          : "border border-rule bg-surface-inset p-4",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-[18px] shrink-0 rounded-none accent-[var(--crimson)]"
      />
      <span className="flex flex-col gap-1">
        <span className="body-compact text-ink">{title}</span>
        {hint ? <span className="caption text-ink-muted">{hint}</span> : null}
        {children}
      </span>
    </label>
  );
}
