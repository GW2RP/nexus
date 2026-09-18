import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** La puce de type : lecture seule, toujours accompagnée de son glyphe.
 *  Ce n'est pas un bouton — c'est un `<span>`. */
const badgeVariants = cva(
  "inline-flex items-center gap-[7px] font-display font-medium uppercase rounded-none border px-[10px] py-[7px] text-[11px] leading-none tracking-[1.4px]",
  {
    variants: {
      variant: {
        default: "bg-chip border-chip-edge text-gold-ink",
        /** Sur une image, la puce passe en crimson pour tenir le contraste. */
        onImage: "bg-crimson border-crimson-edge text-on-crimson",
        success: "bg-transparent border-success text-success",
        neutral: "bg-neutral-badge border-chip-edge text-ink-muted",
        crimson: "bg-crimson border-crimson-edge text-on-crimson",
        outline: "bg-transparent border-gold text-gold-ink",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
