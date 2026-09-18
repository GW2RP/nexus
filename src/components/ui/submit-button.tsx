"use client";

import { useFormStatus } from "react-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";

export function SubmitButton({
  children,
  pendingLabel,
  variant,
  size,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
} & VariantProps<typeof buttonVariants>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending}>
      {pending ? (pendingLabel ?? "En cours…") : children}
    </Button>
  );
}
