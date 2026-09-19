import * as React from "react";

import { cn } from "@/lib/utils";

/** Cartouche `surface` bordé de 1 px `rule`, à angles vifs, sans ombre. */
function Card({
  className,
  accent = false,
  inset = false,
  ...props
}: React.ComponentProps<"div"> & { accent?: boolean; inset?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col rounded-none border",
        inset ? "bg-surface-inset border-chip-edge" : "bg-surface border-rule",
        // Cadre d'accent : la carte qui demande une décision.
        accent && "border-2 border-gold",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex items-start justify-between gap-3", className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"h3">) {
  return (
    <h3
      data-slot="card-title"
      className={cn("card-title", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("body-compact text-ink-body", className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("flex flex-col gap-3", className)} {...props} />;
}

/** Le pied est poussé en bas : les cartes d'une rangée alignent leurs pieds. */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex items-center justify-between gap-3 border-t border-hairline pt-[14px]",
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
