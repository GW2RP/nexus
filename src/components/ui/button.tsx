import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Le bouton du système : angles vifs, libellé en capitales Cinzel.
 *  Une seule variante `default` (crimson) par écran — c'est l'action que la page
 *  existe pour permettre. Pas d'état désactivé grisé pour une action interdite :
 *  on retire l'action et on dit pourquoi. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-[1.6px] rounded-none border transition-none disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-crimson border-crimson-edge text-on-crimson hover:bg-crimson-edge",
        outline:
          "bg-transparent border-gold text-gold-ink hover:bg-surface-selected",
        link: "border-transparent bg-transparent text-crimson-ink underline underline-offset-4 tracking-normal normal-case font-body font-normal hover:text-crimson-edge",
        ghost:
          "border-transparent bg-transparent text-ink-body hover:bg-surface-selected",
        quiet:
          "border-rule bg-transparent text-ink-muted hover:bg-surface-selected",
      },
      size: {
        default: "min-h-tap px-5 py-4 text-[12px]",
        lead: "min-h-tap px-[26px] py-[17px] text-[13px]",
        sm: "min-h-tap px-4 py-3 text-[11px] tracking-[1.5px]",
        icon: "size-tap p-0 text-[12px]",
        inline: "min-h-0 p-0 text-[17px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
