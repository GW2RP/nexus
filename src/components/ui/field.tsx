import * as React from "react";

import { cn } from "@/lib/utils";

/** Champs à angles vifs sur `surface-inset`, bordés de 1 px `rule`.
 *  Chaque contrôle a une étiquette visible : le système ne dessine aucun champ flottant. */

const controlClasses =
  "w-full min-h-tap rounded-none border border-rule bg-surface-inset px-[14px] py-3 text-[17px] text-ink placeholder:text-ink-subtle";

function Label({
  className,
  hidden = false,
  ...props
}: React.ComponentProps<"label"> & { hidden?: boolean }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "text-[16px] leading-[1.45] text-ink-muted",
        // Une étiquette visuellement masquée reste dans le DOM.
        hidden && "absolute size-px overflow-hidden [clip-path:inset(50%)]",
        className,
      )}
      {...props}
    />
  );
}

function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input data-slot="input" className={cn(controlClasses, className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlClasses, "resize-none leading-[1.5]", className)}
      {...props}
    />
  );
}

/** Le chevron natif est conservé : on ne redessine pas la liste déroulante. */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return <select data-slot="select" className={cn(controlClasses, className)} {...props} />;
}

function Checkbox({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn("size-[18px] shrink-0 rounded-none accent-[var(--crimson)]", className)}
      {...props}
    />
  );
}

function Slider({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn("w-full accent-[var(--crimson)]", className)}
      {...props}
    />
  );
}

/** Étiquette au-dessus, contrôle dessous, `space-2` entre les deux. */
function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
        {required ? <span className="sr-only"> (obligatoire)</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-[15px] leading-[1.45] text-ink-subtle">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[15px] leading-[1.45] text-crimson-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { Field, Label, Input, Textarea, Select, Checkbox, Slider, controlClasses };
