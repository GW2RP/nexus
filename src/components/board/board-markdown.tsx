import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { headingSize } from "@/lib/boards";

/** Le texte d'une note ou d'un bloc de texte : le même markdown que les fiches,
 *  réduit à ce que la barre d'outils du panneau sait écrire — titre, gras,
 *  italique, barré, lien, listes et citation. Le reste (image, tableau, code)
 *  n'est pas rendu : il ne vient que d'un texte collé, et un panneau n'est pas
 *  une fiche.
 *
 *  La taille vient de l'élément, choisie sur l'échelle de `tokens.css` ; les
 *  titres prennent le cran au-dessus.
 *
 *  `links` à faux rend les liens comme du texte souligné : dans l'éditeur, un
 *  clic sur une note la saisit, il ne doit pas quitter la page ; dans un aperçu,
 *  le panneau entier est déjà un lien. */

const ALLOWED = ["p", "br", "strong", "em", "del", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6"];

function isExternal(href: string | undefined): boolean {
  return Boolean(href && /^[a-z]+:\/\//i.test(href));
}

export function BoardMarkdown({
  text,
  size,
  links = true,
}: {
  text: string;
  size: number;
  links?: boolean;
}) {
  const heading = ({ children }: { children?: React.ReactNode }) => (
    <p className="font-display font-semibold leading-[1.2]" style={{ fontSize: headingSize(size) }}>
      {children}
    </p>
  );

  return (
    <div className="flex flex-col gap-[0.4em] leading-[1.45]" style={{ fontSize: size }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        allowedElements={ALLOWED}
        unwrapDisallowed
        components={{
          h1: heading,
          h2: heading,
          h3: heading,
          h4: heading,
          h5: heading,
          h6: heading,
          p: ({ children }) => <p>{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          ul: ({ children }) => <ul className="list-disc pl-[1.2em]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-[1.4em]">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="flex flex-col gap-[0.4em] border-l-2 border-gold pl-3 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) =>
            links ? (
              <a
                href={href}
                className="pointer-events-auto text-crimson-ink underline underline-offset-4"
                {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
              >
                {children}
              </a>
            ) : (
              <span className="text-crimson-ink underline underline-offset-4">{children}</span>
            ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
