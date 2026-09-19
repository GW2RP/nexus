"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[840px] px-gutter-mobile py-16 lg:px-gutter-desktop">
      <p className="mb-4 font-display text-[12px] font-medium tracking-[3.5px] text-gold-eyebrow">
        INCIDENT
      </p>
      <h1 className="font-display text-[32px] font-bold leading-[1.1] sm:text-[40px]">
        Quelque chose s'est cassé de notre côté
      </h1>
      <p className="mt-5 max-w-[60ch] body text-ink-body">
        La page n'a pas pu être rendue. Réessayez : si l'incident se répète, l'équipe a besoin
        de le savoir.
      </p>
      {error.digest ? (
        <p className="mt-3 text-[15px] text-ink-muted">Référence : {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-8 inline-flex min-h-tap items-center border border-crimson-edge bg-crimson px-[26px] py-[17px] font-display text-[13px] font-semibold tracking-[1.6px] text-on-crimson"
      >
        RÉESSAYER
      </button>
    </div>
  );
}
