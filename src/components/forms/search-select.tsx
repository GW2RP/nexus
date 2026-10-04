"use client";

import { useId, useMemo, useRef, useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/icons";
import { controlClasses } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type SearchOption = {
  id: string;
  label: string;
  /** Ce qui distingue deux homonymes — la région d'un lieu. Cherché aussi. */
  detail?: string;
};

/** Combien de propositions s'affichent d'un coup. Au-delà, la liste ne se lit
 *  plus : on précise la frappe. */
const PROPOSITIONS_MAX = 40;

/** « Lion Noir » se trouve en tapant « lion noir » ou « lïon » : la casse et les
 *  accents ne départagent rien quand on cherche un nom. */
function plier(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr-FR");
}

/** Le début du nom d'abord, puis le début d'un mot, puis le reste : qui tape
 *  « lion » cherche « Lion Noir » avant « Taverne du Lion ». */
function rang(option: SearchOption, terme: string): number {
  const nom = plier(option.label);
  if (nom.startsWith(terme)) return 0;
  if (nom.split(/[\s'’-]+/).some((mot) => mot.startsWith(terme))) return 1;
  if (nom.includes(terme)) return 2;
  if (option.detail && plier(option.detail).includes(terme)) return 3;
  return -1;
}

/** Une liste déroulante qui se cherche. Le registre compte trop de lieux pour
 *  qu'on les fasse défiler un à un : on tape, la liste se resserre, et la valeur
 *  part dans le formulaire par un champ caché, comme d'une liste native.
 *
 *  Les options arrivent entières du serveur et se filtrent sur place : la
 *  recherche répond à la frappe, sans aller-retour.
 *
 *  Le motif est celui d'un `combobox` ARIA : le focus reste dans le champ, et
 *  les flèches parcourent la liste par `aria-activedescendant`. */
export function SearchSelect({
  id,
  name,
  options,
  value,
  onChange,
  placeholder,
  noneLabel,
  required = false,
  invalid = false,
  describedBy,
}: {
  id: string;
  name: string;
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Proposé en tête quand le champ admet de ne rien choisir. */
  noneLabel?: string;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const champ = useRef<HTMLInputElement>(null);
  const choisi = options.find((option) => option.id === value) ?? null;

  // `query` à `null` : on ne cherche pas, le champ montre le choix courant.
  const [query, setQuery] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);

  const terme = plier((query ?? "").trim());
  const { propositions, reste } = useMemo(() => {
    const trouvees = terme
      ? options
          .map((option) => ({ option, rang: rang(option, terme) }))
          .filter((entree) => entree.rang >= 0)
          // Le tri est stable : à rang égal, l'ordre du serveur (alphabétique)
          // tient.
          .sort((a, b) => a.rang - b.rang)
          .map((entree) => entree.option)
      : options;
    return {
      propositions: trouvees.slice(0, PROPOSITIONS_MAX),
      reste: Math.max(0, trouvees.length - PROPOSITIONS_MAX),
    };
  }, [options, terme]);

  // « Aucun » ne se propose que sans recherche : qui tape un nom cherche ce nom.
  const avecAucun = Boolean(noneLabel) && !terme;
  const entrees: (SearchOption | null)[] = avecAucun ? [null, ...propositions] : propositions;
  const indexActif = Math.min(actif, Math.max(0, entrees.length - 1));

  function choisir(option: SearchOption | null) {
    onChange(option?.id ?? "");
    setQuery(null);
    setOuvert(false);
  }

  function fermer() {
    // Un nom tapé à moitié ne choisit rien : le champ revient au choix courant,
    // sauf s'il a été vidé, ce qui vaut « aucun ».
    if (query !== null && query.trim() === "" && !required) onChange("");
    setQuery(null);
    setOuvert(false);
  }

  function auClavier(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!ouvert) {
        setOuvert(true);
        setActif(0);
        return;
      }
      const pas = event.key === "ArrowDown" ? 1 : -1;
      setActif((indexActif + pas + entrees.length) % Math.max(1, entrees.length));
    } else if (event.key === "Enter" && ouvert) {
      // Entrée choisit l'option active ; elle n'envoie pas le formulaire.
      event.preventDefault();
      if (entrees.length > 0) choisir(entrees[indexActif]);
    } else if (event.key === "Escape" && ouvert) {
      event.preventDefault();
      setQuery(null);
      setOuvert(false);
    }
  }

  const idOption = (index: number) => `${listId}-${index}`;

  return (
    <div
      className="relative"
      onBlur={(event) => {
        // Un clic dans la liste garde le focus dans ce bloc : on ne ferme que
        // quand il le quitte vraiment.
        if (!event.currentTarget.contains(event.relatedTarget)) fermer();
      }}
    >
      <input type="hidden" name={name} value={value} />

      <SearchIcon
        size={18}
        className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 text-ink-subtle"
      />
      <input
        ref={champ}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        spellCheck={false}
        aria-expanded={ouvert}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={ouvert && entrees.length > 0 ? idOption(indexActif) : undefined}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={query ?? choisi?.label ?? ""}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOuvert(true);
          setActif(0);
        }}
        onFocus={(event) => event.target.select()}
        onClick={() => setOuvert(true)}
        onKeyDown={auClavier}
        className={cn(
          controlClasses,
          "pl-[42px]",
          choisi ? "pr-[46px]" : null,
        )}
      />

      {choisi ? (
        <button
          type="button"
          onClick={() => {
            choisir(null);
            champ.current?.focus();
          }}
          aria-label={`Retirer ${choisi.label}`}
          className="absolute top-1/2 right-[6px] flex size-[36px] -translate-y-1/2 items-center justify-center text-ink-muted hover:text-crimson-ink"
        >
          <CloseIcon size={14} />
        </button>
      ) : null}

      {ouvert ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 border border-rule bg-surface">
          <ul id={listId} role="listbox" className="max-h-[320px] overflow-y-auto">
            {entrees.map((option, index) => (
              <li
                key={option?.id ?? "aucun"}
                id={idOption(index)}
                role="option"
                aria-selected={(option?.id ?? "") === value}
                // La souris ne vole pas le focus au champ : le choix se fait au
                // clic, le champ garde la main.
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActif(index)}
                onClick={() => choisir(option)}
                className={cn(
                  "flex min-h-tap cursor-pointer items-baseline justify-between gap-4 border-b border-hairline px-[14px] py-2 last:border-b-0",
                  index === indexActif ? "bg-surface-selected" : null,
                )}
              >
                <span className={cn("body-compact", option ? "text-ink" : "text-ink-muted")}>
                  {option?.label ?? noneLabel}
                </span>
                {option?.detail ? (
                  <span className="caption shrink-0 text-ink-subtle">{option.detail}</span>
                ) : null}
              </li>
            ))}
          </ul>
          {entrees.length === 0 ? (
            <p className="caption px-[14px] py-3 text-ink-subtle">Aucun résultat.</p>
          ) : null}
          {reste > 0 ? (
            <p className="caption border-t border-hairline px-[14px] py-2 text-ink-subtle">
              {`Et ${reste} autre${reste > 1 ? "s" : ""} : précisez la recherche.`}
            </p>
          ) : null}
          <p aria-live="polite" className="sr-only">
            {terme ? `${propositions.length + reste} résultat${propositions.length + reste > 1 ? "s" : ""}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
