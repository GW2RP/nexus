"use client";

import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { Input, Label } from "@/components/ui/field";
import { searchAccountsAction } from "@/server/actions/accounts";
import type { AuthorSummary } from "@/server/types";

/** Des comptes cherchés par leur pseudo, ajoutés un à un.
 *
 *  Le même geste sert partout où l'on nomme quelqu'un : les co-gérants d'un
 *  lieu, les invités d'une scène privée, les membres d'un cercle. Une seule
 *  implémentation, donc un seul comportement — la recherche part après la
 *  frappe, et « aucun compte » ne se dit jamais trop tôt. */
export function AccountPicker({
  label,
  inputId,
  placeholder = "Pseudo du joueur",
  selected,
  /** Les comptes qu'on ne propose pas : soi-même, ceux déjà nommés ailleurs. */
  excludeIds = [],
  onAdd,
  onRemove,
  removeLabel,
  hint,
  error,
}: {
  label: string;
  inputId: string;
  placeholder?: string;
  selected: AuthorSummary[];
  excludeIds?: string[];
  onAdd: (account: AuthorSummary) => void;
  onRemove: (id: string) => void;
  removeLabel: (name: string) => string;
  hint?: string;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  // Le résultat porte le terme qu'il répond : tant que les deux diffèrent, la
  // recherche est en cours, et « aucun compte » serait dit trop tôt. `accounts`
  // à `null` dit que la recherche a échoué — ce qui n'est pas la même chose que
  // n'avoir trouvé personne.
  const [result, setResult] = useState<{
    terme: string;
    accounts: AuthorSummary[] | null;
  } | null>(null);

  const terme = query.trim();

  useEffect(() => {
    if (terme.length < 2) return;

    // La recherche part après la frappe, pas à chaque touche. `abandoned` couvre
    // ce que `clearTimeout` ne couvre pas : la requête déjà partie, dont la
    // réponse tardive écraserait sinon celle d'un terme plus récent.
    let abandoned = false;
    const timer = setTimeout(() => {
      searchAccountsAction(terme)
        .then((accounts) => {
          if (!abandoned) setResult({ terme, accounts });
        })
        .catch(() => {
          if (!abandoned) setResult({ terme, accounts: null });
        });
    }, 300);

    return () => {
      abandoned = true;
      clearTimeout(timer);
    };
  }, [terme]);

  const reponse = result?.terme === terme ? result : null;
  const ecartes = new Set([...excludeIds, ...selected.map((account) => account.id)]);
  const proposed = (reponse?.accounts ?? []).filter((account) => !ecartes.has(account.id));

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{label}</Label>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selected.map((account) => (
            <li
              key={account.id}
              className="inline-flex items-center gap-2 border border-chip-edge bg-chip px-[10px] py-[7px]"
            >
              <span className="text-[16px] text-ink">{account.name}</span>
              <button
                type="button"
                onClick={() => onRemove(account.id)}
                aria-label={removeLabel(account.name)}
                className="text-ink-muted hover:text-crimson-ink"
              >
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Input
        id={inputId}
        type="search"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
      />

      {proposed.length > 0 ? (
        <ul className="flex flex-col border border-rule">
          {proposed.map((account) => (
            <li key={account.id} className="border-b border-hairline last:border-b-0">
              <button
                type="button"
                onClick={() => {
                  onAdd(account);
                  setQuery("");
                }}
                className="flex min-h-tap w-full items-center px-[14px] text-left text-[17px] text-ink hover:bg-surface-selected"
              >
                {account.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {reponse?.accounts && proposed.length === 0 ? (
        <p className="caption text-ink-subtle">Aucun compte à ce nom.</p>
      ) : null}

      {reponse && reponse.accounts === null ? (
        <p role="alert" className="caption text-crimson-ink">
          La recherche n&apos;a pas abouti. Réessayez.
        </p>
      ) : null}

      {hint ? <p className="caption text-ink-subtle">{hint}</p> : null}

      {error ? (
        <p role="alert" className="caption text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
