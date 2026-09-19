import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/** Le texte long d'une fiche, écrit en markdown par son auteur.
 *
 *  Aucun HTML brut n'est interprété : `react-markdown` sans `rehype-raw` rend des
 *  éléments React, jamais une chaîne injectée. Une balise écrite dans le champ
 *  s'affiche donc telle quelle plutôt que de s'exécuter.
 *
 *  Les styles ne sont pas réinventés : le conteneur porte `.body`, et les
 *  paragraphes en héritent. Seuls les blocs qui s'en écartent — intertitre,
 *  citation, liste — reprennent une classe de `tokens.css`. */

const LINK_CLASSES = "text-crimson-ink underline underline-offset-4";

/** Un lien qui sort du hub s'ouvre à côté, et n'emporte pas la page avec lui. */
function isExternal(href: string | undefined): boolean {
  return Boolean(href && /^[a-z]+:\/\//i.test(href));
}

/** Toutes les hauteurs de titre retombent sur le même intertitre : la page porte
 *  déjà son `h1` et ses `h2` de section, et un `#` saisi dans le champ ne doit
 *  pas trouer ce plan. */
function Intertitre({ children }: ComponentPropsWithoutRef<"h3">) {
  return <h3 className="card-title text-ink">{children}</h3>;
}

export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex max-w-[70ch] flex-col gap-4 body text-ink-body", className)}>
      <ReactMarkdown
        // `remark-breaks` : un retour à la ligne simple en est un. C'est ce que
        // l'éditeur montre en écrivant, et ce que les fiches d'avant le markdown
        // — écrites ligne à ligne dans une zone de texte — veulent dire.
        remarkPlugins={[remarkGfm, remarkBreaks]}
        // Une image ne se pose pas dans un champ de texte : elle passe par le
        // téléversement, qui la range sous son auteur.
        disallowedElements={["img"]}
        unwrapDisallowed
        components={{
          h1: Intertitre,
          h2: Intertitre,
          h3: Intertitre,
          h4: Intertitre,
          h5: Intertitre,
          h6: Intertitre,
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          // Une liste n'est pas une colonne flex : la puce d'un élément de liste
          // ne survit pas toujours à la mise en boîte d'un conteneur flex.
          ul: ({ children }) => <ul className="list-disc space-y-2 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-2 pl-5">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="flex flex-col gap-4 border-l-2 border-gold pl-4 quote text-ink-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="h-px border-0 bg-rule" />,
          code: ({ children }) => (
            <code className="border border-hairline bg-surface-inset px-1">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto border border-rule bg-surface-inset p-4">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <table className="w-full border-collapse border border-rule text-left">
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th className="border border-hairline p-2 font-display font-semibold">{children}</th>
          ),
          td: ({ children }) => <td className="border border-hairline p-2">{children}</td>,
          a: ({ href, children }) =>
            isExternal(href) ? (
              <a
                href={href}
                className={LINK_CLASSES}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                {children}
              </a>
            ) : (
              <a href={href} className={LINK_CLASSES}>
                {children}
              </a>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
