"use client";

import { useSearchParams } from "next/navigation";
import { useOptimistic } from "react";

import { useUrlFilters } from "@/components/ui/url-filters";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** La rangée de filtres : même forme que la puce de type, mais ce sont des boutons.
 *  Le premier est un « tout » actif par défaut. Les filtres vivent dans l'URL —
 *  c'est ce qui permet de partager un lien de liste filtrée.
 *
 *  La puce cliquée s'allume avant que le serveur réponde : c'est un choix, et
 *  un choix se voit au moment où on le fait. `useOptimistic` la rend à sa
 *  valeur réelle dès que la navigation aboutit — ou revient en arrière si elle
 *  échoue, plutôt que de laisser une puce allumée sur une liste qui n'a pas
 *  changé. */
export function FilterChips({
  name,
  options,
  allLabel,
  legend,
  className,
}: {
  name: string;
  options: FilterOption[];
  allLabel: string;
  legend: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const { go } = useUrlFilters();
  const [current, setCurrent] = useOptimistic(searchParams.get(name));

  function select(value: string | null) {
    go({ [name]: value }, () => setCurrent(value));
  }

  return (
    <fieldset className={cn("flex flex-wrap gap-2 border-0 p-0", className)}>
      <legend className="sr-only">{legend}</legend>
      <Chip active={!current} onSelect={() => select(null)}>
        {allLabel}
      </Chip>
      {options.map((option) => (
        <Chip
          key={option.value}
          active={current === option.value}
          onSelect={() => select(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </fieldset>
  );
}

function Chip({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "inline-flex min-h-tap items-center rounded-none border px-4 py-[11px] font-display text-[11px] font-medium tracking-[1.4px]",
        active
          ? "border-gold-ink bg-gold-ink text-on-crimson"
          : "border-chip-edge bg-transparent text-gold-ink hover:bg-surface-selected",
      )}
    >
      {children}
    </button>
  );
}
