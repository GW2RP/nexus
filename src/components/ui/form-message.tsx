import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

/** Le retour d'une action, posé dans la page — jamais dans une modale,
 *  jamais en notification permanente. */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.status === "idle" || !state.message) return null;

  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "border px-4 py-3 body-compact",
        isError
          ? "border-crimson-edge bg-surface-inset text-crimson-ink"
          : "border-success bg-surface-inset text-success",
        className,
      )}
    >
      {state.message}
    </p>
  );
}
