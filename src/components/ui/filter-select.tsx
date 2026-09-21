"use client";

import { useSearchParams } from "next/navigation";
import { useId, useOptimistic } from "react";

import { Label, Select } from "@/components/ui/field";
import { useUrlFilters } from "@/components/ui/url-filters";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** Un filtre de registre en liste déroulante.
 *
 *  Même contrat que la rangée de puces — la valeur vit dans l'URL, donc une
 *  liste filtrée se partage — mais repliée : huit types de lieu alignés en
 *  boutons prenaient deux rangs pleine largeur avant la première fiche, et la
 *  page ne montrait plus ce qu'on est venu y chercher.
 *
 *  Le choix s'affiche avant que le serveur réponde (`useOptimistic`), et revient
 *  à sa valeur réelle si la navigation échoue : un sélecteur figé sur une option
 *  que la liste ne montre pas mentirait sur ce qui est filtré. */
export function FilterSelect({
  name,
  label,
  allLabel,
  options,
  className,
}: {
  name: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
  className?: string;
}) {
  const searchParams = useSearchParams();
  const { go } = useUrlFilters();
  const [current, setCurrent] = useOptimistic(searchParams.get(name) ?? "");
  const id = useId();

  return (
    <div className={cn("flex min-w-[200px] flex-1 flex-col gap-2 sm:max-w-[260px]", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        name={name}
        value={current}
        onChange={(event) => {
          const choix = event.target.value;
          go({ [name]: choix || null }, () => setCurrent(choix));
        }}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
