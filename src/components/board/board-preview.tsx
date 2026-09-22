"use client";

import { useEffect, useRef, useState } from "react";

import { StaticBoard } from "@/components/board/board-layer";
import { contentBounds, type BoardContent } from "@/lib/boards";
import { cn } from "@/lib/utils";

/** Un panneau en réduction, cadré sur ce qu'il porte. Il ne grossit jamais
 *  au-delà de sa taille réelle : un panneau d'une seule note ne s'affiche pas
 *  en affiche. Un panneau vide dit qu'il l'est, sur la hachure. */
export function BoardPreview({
  content,
  height,
  className,
}: {
  content: BoardContent;
  /** La hauteur du cadre, en pixels. */
  height: number;
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const bounds = contentBounds(content.elements);

  if (!bounds) {
    return (
      <div
        className={cn("hatch flex items-center justify-center border border-hairline", className)}
        style={{ height }}
      >
        <span className="font-display text-[13px] font-medium tracking-[2px] text-gold-eyebrow">
          [ PANNEAU VIDE ]
        </span>
      </div>
    );
  }

  const scale = width ? Math.min(1, width / bounds.w, height / bounds.h) : 0;
  const offsetX = width ? (width - bounds.w * scale) / 2 - bounds.x * scale : 0;
  const offsetY = (height - bounds.h * scale) / 2 - bounds.y * scale;

  return (
    <div
      ref={frameRef}
      aria-hidden="true"
      className={cn("relative overflow-hidden border border-hairline bg-ground", className)}
      style={{ height }}
    >
      {width ? (
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})` }}
        >
          <StaticBoard content={content} links={false} />
        </div>
      ) : null}
    </div>
  );
}
