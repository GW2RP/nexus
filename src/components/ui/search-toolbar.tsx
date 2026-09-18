"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

import { SearchIcon } from "@/components/icons";
import { Label, Select } from "@/components/ui/field";

/** La barre d'outils d'un registre : recherche, tri, options.
 *  Tout vit dans l'URL — c'est ce qui permet de partager un lien de liste filtrée. */
export function SearchToolbar({
  searchLabel,
  searchPlaceholder,
  sortLabel,
  sortOptions,
  toggles = [],
}: {
  searchLabel: string;
  searchPlaceholder: string;
  sortLabel?: string;
  sortOptions?: { value: string; label: string }[];
  toggles?: { name: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const inputRef = useRef<HTMLInputElement>(null);

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const next = params.toString();
    router.push(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        update({ q: inputRef.current?.value.trim() || null });
      }}
      className="mb-5 flex flex-wrap items-end gap-4"
    >
      <div className="flex min-w-[240px] flex-1 flex-col gap-2">
        <Label htmlFor="toolbar-search">{searchLabel}</Label>
        <div className="flex items-center gap-2 border border-rule bg-surface-inset px-3">
          <SearchIcon size={16} className="text-ink-muted" />
          <input
            id="toolbar-search"
            // La clé remonte le champ quand l'URL change : il reste non
            // contrôlé, et suit quand même le filtre partagé par un lien.
            key={currentQuery}
            ref={inputRef}
            type="search"
            name="q"
            defaultValue={currentQuery}
            placeholder={searchPlaceholder}
            className="min-h-tap w-full bg-transparent text-[17px] text-ink placeholder:text-ink-subtle focus-visible:outline-none"
          />
        </div>
      </div>

      {sortOptions && sortOptions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="toolbar-sort">{sortLabel ?? "Trier par"}</Label>
          <Select
            id="toolbar-sort"
            name="tri"
            value={searchParams.get("tri") ?? sortOptions[0].value}
            onChange={(event) => update({ tri: event.target.value })}
            className="w-auto"
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {toggles.map((toggle) => (
        <label
          key={toggle.name}
          className="flex min-h-tap items-center gap-3 text-[17px] text-ink-body"
        >
          <input
            type="checkbox"
            checked={searchParams.get(toggle.name) === "1"}
            onChange={(event) => update({ [toggle.name]: event.target.checked ? "1" : null })}
            className="size-[18px] accent-[var(--crimson)]"
          />
          {toggle.label}
        </label>
      ))}

      <button type="submit" className="sr-only">
        Rechercher
      </button>
    </form>
  );
}
