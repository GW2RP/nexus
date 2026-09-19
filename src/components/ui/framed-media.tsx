import { cn } from "@/lib/utils";

/** Le double cadre : `surface` bordé 2 px `rule`, 10 px de marge intérieure,
 *  puis un filet de 1 px autour de l'image. Toute image téléversée le porte.
 *
 *  Sans image, la zone affiche la hachure et son libellé entre crochets, avec la
 *  dimension attendue. Ce placeholder n'est pas un état d'erreur : il dit ce qui
 *  manque et sa taille. */
export function FramedMedia({
  src,
  alt,
  placeholder,
  dimensions,
  aspect = "16 / 5",
  className,
  innerClassName,
  children,
}: {
  src?: string | null;
  alt?: string | null;
  placeholder: string;
  dimensions?: string;
  aspect?: string;
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
}) {
  const label = dimensions ? `[ ${placeholder} · ${dimensions} ]` : `[ ${placeholder} ]`;

  return (
    <div className={cn("framed", className)}>
      <div
        className={cn("relative w-full overflow-hidden border border-rule", innerClassName)}
        style={{ aspectRatio: aspect }}
      >
        {src ? (
          // Recadrage en cover : aucun texte ne doit dépendre d'une zone de l'image.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt ?? ""} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="hatch flex size-full items-center justify-center px-4 text-center">
            <span className="font-display text-[11px] font-medium tracking-[1.4px] text-gold-eyebrow sm:text-[13px] sm:tracking-[2px]">
              {label}
            </span>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** Le portrait rond d'une ligne de registre : hachure tant que rien n'est téléversé. */
export function RoundPortrait({
  src,
  alt,
  size = 52,
  className,
}: {
  src?: string | null;
  alt?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-rule",
        !src && "hatch-tight",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt ?? ""} className="size-full object-cover" loading="lazy" />
      ) : null}
    </span>
  );
}
