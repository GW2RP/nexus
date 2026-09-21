"use client";

import { useSearchParams } from "next/navigation";
import { useId, useOptimistic } from "react";

import { Checkbox } from "@/components/ui/field";
import { useUrlFilters } from "@/components/ui/url-filters";
import { cn } from "@/lib/utils";

/** Un filtre qui s'arme ou se désarme, dans l'URL comme les autres.
 *
 *  Une vraie case à cocher, et non un lien déguisé en case : l'état est alors
 *  porté par `checked`, que les technologies d'assistance lisent, plutôt que
 *  par un `aria-label` qui le raconte. La barre d'espace la bascule aussi, ce
 *  qu'un lien ne fait pas.
 *
 *  Elle se coche avant que le serveur réponde, et se décoche si la navigation
 *  échoue : même contrat que `FilterSelect`. */
export function FilterToggle({
  name,
  label,
  className,
}: {
  name: string;
  label: string;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const { go } = useUrlFilters();
  const [actif, setActif] = useOptimistic(searchParams.get(name) === "1");
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn("flex min-h-tap items-center gap-3 body-compact text-ink-body", className)}
    >
      <Checkbox
        id={id}
        name={name}
        checked={actif}
        onChange={(event) => {
          const coche = event.target.checked;
          go({ [name]: coche ? "1" : null }, () => setActif(coche));
        }}
      />
      {label}
    </label>
  );
}
