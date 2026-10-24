"use client";

import { useEffect, useRef, useState } from "react";

import type { VrScene } from "@/components/board/board-vr-scene";
import { useXrSupport } from "@/components/board/use-xr-support";
import { Button } from "@/components/ui/button";
import type { BoardContent } from "@/lib/boards";

/** Le panneau en tableau de détective. Hors casque, la scène se montre dans la
 *  page — on la fait tourner en glissant le fond, on décroche une note en la
 *  glissant ; dans le casque, la gâchette fait la même chose. Rien ne s'y
 *  enregistre. */
export function BoardVr({ content, label }: { content: BoardContent; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VrScene | null>(null);
  const { vr, ar } = useXrSupport();
  const [state, setState] = useState<"chargement" | "pret" | "indisponible">("chargement");
  const [inSession, setInSession] = useState(false);
  const [moved, setMoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let scene: VrScene | null = null;
    import("@/components/board/board-vr-scene")
      .then(({ createVrScene }) =>
        createVrScene({ container, content, onSession: setInSession, onMoved: setMoved }),
      )
      .then((created) => {
        scene = created;
        if (cancelled) {
          created.dispose();
          return;
        }
        sceneRef.current = created;
        setState("pret");
      })
      .catch(() => {
        if (!cancelled) setState("indisponible");
      });
    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [content]);

  // Les entrées en immersion, une fois la scène prête et hors session.
  const offre = (vr || ar) && state === "pret" && !inSession;

  async function enter(mode: XRSessionMode) {
    setError(null);
    try {
      await sceneRef.current?.enter(mode);
    } catch {
      setError("Le casque a refusé la session.");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {offre || moved || error ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-gutter-mobile py-3 lg:px-gutter-app">
          {offre && vr ? (
            <Button onClick={() => enter("immersive-vr")}>{"Entrer en VR".toLocaleUpperCase("fr-FR")}</Button>
          ) : null}
          {offre && ar ? (
            <Button variant="outline" onClick={() => enter("immersive-ar")}>
              {"Réalité mixte".toLocaleUpperCase("fr-FR")}
            </Button>
          ) : null}
          {moved ? (
            <Button variant="quiet" onClick={() => sceneRef.current?.reset()}>
              {"Remettre en place".toLocaleUpperCase("fr-FR")}
            </Button>
          ) : null}
          {error ? (
            <p role="alert" className="meta text-crimson-ink">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      <div
        ref={containerRef}
        role="img"
        aria-label={label}
        className="relative h-[70dvh] min-h-0 cursor-grab active:cursor-grabbing lg:h-auto lg:flex-1"
      >
        {state !== "pret" ? (
          <div className="hatch absolute inset-0 flex items-center justify-center">
            <span className="font-display text-[13px] font-medium tracking-[2px] text-gold-eyebrow">
              {state === "chargement" ? "[ CHARGEMENT ]" : "[ 3D INDISPONIBLE ]"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
