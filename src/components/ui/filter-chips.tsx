"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };

/** La rangée de filtres : même forme que la puce de type, mais ce sont des boutons.
 *  Le premier est un « tout » actif par défaut. Les filtres vivent dans l'URL —
 *  c'est ce qui permet de partager un lien de liste filtrée. */
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(name);

  function select(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    // Un changement de filtre remet la liste à sa première page.
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
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
